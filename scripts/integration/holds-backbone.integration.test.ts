import { describe, expect, it } from "vitest";
import { getPrisma } from "../../src/server/db/prisma";
import { createOperationalHoldForJob, releaseHoldForTenant } from "../../src/server/slice1/mutations/hold-mutations";
import { startRuntimeTaskForTenant } from "../../src/server/slice1/mutations/runtime-task-execution";
import { getGlobalWorkFeedReadModelForTenant } from "../../src/server/slice1/reads/global-work-feed-reads";
import { sha256HexUtf8, canonicalStringify } from "../../src/server/slice1/compose-preview/freeze-snapshots";

describe("operational holds backbone (Epic 29 / 48)", () => {
  it("job-wide hold blocks runtime start; release clears; work feed shows blocked lane", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `hold-${suffix}`;
    const userId = `user-hold-${suffix}`;

    await prisma.tenant.create({ data: { id: tenantId, name: "Hold T", autoActivateOnSign: false } });
    await prisma.user.create({
      data: { id: userId, tenantId, email: `hold-${suffix}@t.com`, role: "OFFICE_ADMIN" },
    });
    const customer = await prisma.customer.create({ data: { tenantId, name: "C" } });
    const fg = await prisma.flowGroup.create({ data: { tenantId, customerId: customer.id, name: "FG" } });
    const quote = await prisma.quote.create({
      data: { tenantId, customerId: customer.id, flowGroupId: fg.id, quoteNumber: `QH-${suffix}` },
    });
    const wt = await prisma.workflowTemplate.create({ data: { tenantId, templateKey: `TK-${suffix}`, displayName: "T" } });
    const wv = await prisma.workflowVersion.create({
      data: {
        workflowTemplateId: wt.id,
        versionNumber: 1,
        status: "PUBLISHED",
        publishedAt: new Date(),
        snapshotJson: { nodes: [{ id: "N1", type: "TASK" }] },
      },
    });
    const qv1Id = `qv-h-${suffix}`;
    const pkgV1 = {
      schemaVersion: "executionPackageSnapshot.v0",
      pinnedWorkflowVersionId: wv.id,
      slots: [
        {
          packageTaskId: "PT-A",
          nodeId: "N1",
          source: "SOLD_SCOPE",
          planTaskIds: ["PL-A"],
          displayTitle: "Task A",
          lineItemId: "L1",
        },
      ],
      skippedSkeletonSlotCount: 0,
    };
    const planV1 = {
      schemaVersion: "generatedPlanSnapshot.v0",
      quoteVersionId: qv1Id,
      rows: [{ planTaskId: "PL-A" }],
    };
    const qv1 = await prisma.quoteVersion.create({
      data: {
        id: qv1Id,
        quoteId: quote.id,
        versionNumber: 1,
        status: "SIGNED",
        createdById: userId,
        pinnedWorkflowVersionId: wv.id,
        executionPackageSnapshot: pkgV1,
        packageSnapshotSha256: sha256HexUtf8(canonicalStringify(pkgV1)),
        generatedPlanSnapshot: planV1,
        planSnapshotSha256: sha256HexUtf8(canonicalStringify(planV1)),
      },
    });
    const job = await prisma.job.create({ data: { tenantId, flowGroupId: fg.id } });
    const flow1 = await prisma.flow.create({
      data: { tenantId, jobId: job.id, quoteVersionId: qv1.id, workflowVersionId: wv.id },
    });
    await prisma.activation.create({
      data: {
        tenantId,
        jobId: job.id,
        flowId: flow1.id,
        quoteVersionId: qv1.id,
        packageSnapshotSha256: qv1.packageSnapshotSha256!,
        activatedById: userId,
      },
    });
    const rtA = await prisma.runtimeTask.create({
      data: {
        tenantId,
        flowId: flow1.id,
        packageTaskId: "PT-A",
        nodeId: "N1",
        quoteVersionId: qv1.id,
        lineItemId: "L1",
        planTaskIds: ["PL-A"],
        displayTitle: "Task A",
      },
    });

    try {
      const hold = await createOperationalHoldForJob(prisma, {
        tenantId,
        jobId: job.id,
        createdById: userId,
        reason: "Permit pending",
      });

      const blockedStart = await startRuntimeTaskForTenant(prisma, {
        tenantId,
        runtimeTaskId: rtA.id,
        actorUserId: userId,
        request: {},
      });
      expect(blockedStart.ok).toBe(false);
      if (blockedStart.ok) throw new Error("expected block");
      expect(blockedStart.kind).toBe("hold_active");

      const feedWhileHeld = await getGlobalWorkFeedReadModelForTenant(prisma, { tenantId, fetchCap: 50, maxRows: 50 });
      expect(feedWhileHeld.schemaVersion).toBe(4);
      const rowWhileHeld = feedWhileHeld.rows.find((r) => r.runtimeTaskId === rtA.id);
      expect(rowWhileHeld?.lane).toBe("blocked");
      expect(rowWhileHeld?.actionability.start.reasons).toContain("HOLD_ACTIVE");
      const holdDetail = rowWhileHeld?.actionability.start.blockerDetails.find((d) => d.kind === "operational_hold");
      expect(holdDetail?.kind).toBe("operational_hold");
      if (holdDetail?.kind === "operational_hold") {
        expect(holdDetail.holdId).toBe(hold.id);
        expect(holdDetail.reason).toBe("Permit pending");
        expect(holdDetail.scope).toBe("JOB");
      }

      await releaseHoldForTenant(prisma, {
        tenantId,
        holdId: hold.id,
        releasedById: userId,
      });

      const okStart = await startRuntimeTaskForTenant(prisma, {
        tenantId,
        runtimeTaskId: rtA.id,
        actorUserId: userId,
        request: {},
      });
      expect(okStart.ok).toBe(true);

      const feedAfter = await getGlobalWorkFeedReadModelForTenant(prisma, { tenantId, fetchCap: 50, maxRows: 50 });
      const rowAfter = feedAfter.rows.find((r) => r.runtimeTaskId === rtA.id);
      expect(rowAfter?.lane).toBe("completable");
      expect(rowAfter?.actionability.start.reasons).not.toContain("HOLD_ACTIVE");
    } finally {
      await prisma.hold.deleteMany({ where: { tenantId } });
      await prisma.taskExecution.deleteMany({ where: { tenantId } });
      await prisma.runtimeTask.deleteMany({ where: { tenantId } });
      await prisma.activation.deleteMany({ where: { jobId: job.id } });
      await prisma.flow.deleteMany({ where: { jobId: job.id } });
      await prisma.job.deleteMany({ where: { id: job.id } });
      await prisma.quoteVersion.deleteMany({ where: { quoteId: quote.id } });
      await prisma.quote.deleteMany({ where: { id: quote.id } });
      await prisma.flowGroup.deleteMany({ where: { id: fg.id } });
      await prisma.customer.deleteMany({ where: { id: customer.id } });
      await prisma.workflowVersion.deleteMany({ where: { workflowTemplateId: wt.id } });
      await prisma.workflowTemplate.deleteMany({ where: { id: wt.id } });
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }
  });

  it("task-scoped hold blocks only that runtime task", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `hold2-${suffix}`;
    const userId = `user-h2-${suffix}`;

    await prisma.tenant.create({ data: { id: tenantId, name: "H2", autoActivateOnSign: false } });
    await prisma.user.create({
      data: { id: userId, tenantId, email: `h2-${suffix}@t.com`, role: "OFFICE_ADMIN" },
    });
    const customer = await prisma.customer.create({ data: { tenantId, name: "C" } });
    const fg = await prisma.flowGroup.create({ data: { tenantId, customerId: customer.id, name: "FG" } });
    const quote = await prisma.quote.create({
      data: { tenantId, customerId: customer.id, flowGroupId: fg.id, quoteNumber: `Q2-${suffix}` },
    });
    const wt = await prisma.workflowTemplate.create({ data: { tenantId, templateKey: `T2-${suffix}`, displayName: "T" } });
    const wv = await prisma.workflowVersion.create({
      data: {
        workflowTemplateId: wt.id,
        versionNumber: 1,
        status: "PUBLISHED",
        publishedAt: new Date(),
        snapshotJson: { nodes: [{ id: "N1", type: "TASK" }, { id: "N2", type: "TASK" }] },
      },
    });
    const qv1Id = `qv2-${suffix}`;
    const pkgV1 = {
      schemaVersion: "executionPackageSnapshot.v0",
      pinnedWorkflowVersionId: wv.id,
      slots: [
        {
          packageTaskId: "PT-A",
          nodeId: "N1",
          source: "SOLD_SCOPE",
          planTaskIds: ["PL-A"],
          displayTitle: "A",
          lineItemId: "L1",
        },
        {
          packageTaskId: "PT-B",
          nodeId: "N2",
          source: "SOLD_SCOPE",
          planTaskIds: ["PL-B"],
          displayTitle: "B",
          lineItemId: "L2",
        },
      ],
      skippedSkeletonSlotCount: 0,
    };
    const planV1 = {
      schemaVersion: "generatedPlanSnapshot.v0",
      quoteVersionId: qv1Id,
      rows: [{ planTaskId: "PL-A" }, { planTaskId: "PL-B" }],
    };
    const qv1 = await prisma.quoteVersion.create({
      data: {
        id: qv1Id,
        quoteId: quote.id,
        versionNumber: 1,
        status: "SIGNED",
        createdById: userId,
        pinnedWorkflowVersionId: wv.id,
        executionPackageSnapshot: pkgV1,
        packageSnapshotSha256: sha256HexUtf8(canonicalStringify(pkgV1)),
        generatedPlanSnapshot: planV1,
        planSnapshotSha256: sha256HexUtf8(canonicalStringify(planV1)),
      },
    });
    const job = await prisma.job.create({ data: { tenantId, flowGroupId: fg.id } });
    const flow1 = await prisma.flow.create({
      data: { tenantId, jobId: job.id, quoteVersionId: qv1.id, workflowVersionId: wv.id },
    });
    await prisma.activation.create({
      data: {
        tenantId,
        jobId: job.id,
        flowId: flow1.id,
        quoteVersionId: qv1.id,
        packageSnapshotSha256: qv1.packageSnapshotSha256!,
        activatedById: userId,
      },
    });
    const rtA = await prisma.runtimeTask.create({
      data: {
        tenantId,
        flowId: flow1.id,
        packageTaskId: "PT-A",
        nodeId: "N1",
        quoteVersionId: qv1.id,
        lineItemId: "L1",
        planTaskIds: ["PL-A"],
        displayTitle: "A",
      },
    });
    const rtB = await prisma.runtimeTask.create({
      data: {
        tenantId,
        flowId: flow1.id,
        packageTaskId: "PT-B",
        nodeId: "N2",
        quoteVersionId: qv1.id,
        lineItemId: "L2",
        planTaskIds: ["PL-B"],
        displayTitle: "B",
      },
    });

    try {
      await createOperationalHoldForJob(prisma, {
        tenantId,
        jobId: job.id,
        createdById: userId,
        reason: "RFI on task A only",
        runtimeTaskId: rtA.id,
      });

      const startA = await startRuntimeTaskForTenant(prisma, {
        tenantId,
        runtimeTaskId: rtA.id,
        actorUserId: userId,
        request: {},
      });
      expect(startA.ok).toBe(false);
      if (startA.ok) throw new Error("unexpected");
      expect(startA.kind).toBe("hold_active");

      const startB = await startRuntimeTaskForTenant(prisma, {
        tenantId,
        runtimeTaskId: rtB.id,
        actorUserId: userId,
        request: {},
      });
      expect(startB.ok).toBe(true);
    } finally {
      await prisma.hold.deleteMany({ where: { tenantId } });
      await prisma.taskExecution.deleteMany({ where: { tenantId } });
      await prisma.runtimeTask.deleteMany({ where: { tenantId } });
      await prisma.activation.deleteMany({ where: { jobId: job.id } });
      await prisma.flow.deleteMany({ where: { jobId: job.id } });
      await prisma.job.deleteMany({ where: { id: job.id } });
      await prisma.quoteVersion.deleteMany({ where: { quoteId: quote.id } });
      await prisma.quote.deleteMany({ where: { id: quote.id } });
      await prisma.flowGroup.deleteMany({ where: { id: fg.id } });
      await prisma.customer.deleteMany({ where: { id: customer.id } });
      await prisma.workflowVersion.deleteMany({ where: { workflowTemplateId: wt.id } });
      await prisma.workflowTemplate.deleteMany({ where: { id: wt.id } });
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }
  });

  it("release on non-active hold is refused", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `hold3-${suffix}`;
    const userId = `user-h3-${suffix}`;

    await prisma.tenant.create({ data: { id: tenantId, name: "H3", autoActivateOnSign: false } });
    await prisma.user.create({
      data: { id: userId, tenantId, email: `h3-${suffix}@t.com`, role: "OFFICE_ADMIN" },
    });
    const customer = await prisma.customer.create({ data: { tenantId, name: "C" } });
    const fg = await prisma.flowGroup.create({ data: { tenantId, customerId: customer.id, name: "FG" } });
    const job = await prisma.job.create({ data: { tenantId, flowGroupId: fg.id } });
    const h = await prisma.hold.create({
      data: {
        tenantId,
        jobId: job.id,
        holdType: "OPERATIONAL_CUSTOM",
        status: "RELEASED",
        reason: "x",
        createdById: userId,
        releasedAt: new Date(),
        releasedById: userId,
      },
    });
    try {
      await expect(
        releaseHoldForTenant(prisma, { tenantId, holdId: h.id, releasedById: userId }),
      ).rejects.toMatchObject({ code: "HOLD_RELEASE_NOT_ACTIVE" });
    } finally {
      await prisma.hold.deleteMany({ where: { tenantId } });
      await prisma.job.deleteMany({ where: { id: job.id } });
      await prisma.flowGroup.deleteMany({ where: { id: fg.id } });
      await prisma.customer.deleteMany({ where: { id: customer.id } });
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }
  });
});
