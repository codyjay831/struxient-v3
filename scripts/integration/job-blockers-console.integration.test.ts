import { describe, expect, it } from "vitest";
import { getPrisma } from "../../src/server/db/prisma";
import { getJobShellReadModel } from "../../src/server/slice1/reads/job-shell";
import { toJobShellApiDto } from "../../src/lib/job-shell-dto";
import { createOperationalHoldForJob, releaseHoldForTenant } from "../../src/server/slice1/mutations/hold-mutations";
import { satisfyPaymentGateForTenant } from "../../src/server/slice1/mutations/satisfy-payment-gate";
import { sha256HexUtf8, canonicalStringify } from "../../src/server/slice1/compose-preview/freeze-snapshots";

/**
 * Protects the Job Blockers Console slice (Epic 47/48) at the same layer the UI relies on:
 * job shell read → DTO mapping, plus the server mutations behind POST satisfy / holds / release.
 * (HTTP + Auth.js session is not exercised here — see holds-backbone / payment-gating for mutation semantics.)
 */
describe("job blockers console — job shell DTO + gate/hold mutations", () => {
  it("exposes UNSATISFIED payment gate on DTO; satisfyPaymentGateForTenant flips DTO to SATISFIED with satisfiedAt", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `jbc-g-${suffix}`;
    const userId = `user-jbc-g-${suffix}`;

    await prisma.tenant.create({ data: { id: tenantId, name: "JBC Gate", autoActivateOnSign: false } });
    await prisma.user.create({
      data: { id: userId, tenantId, email: `jbc-g-${suffix}@t.com`, role: "OFFICE_ADMIN" },
    });
    const customer = await prisma.customer.create({ data: { tenantId, name: "C" } });
    const fg = await prisma.flowGroup.create({ data: { tenantId, customerId: customer.id, name: "FG" } });
    const quote = await prisma.quote.create({
      data: { tenantId, customerId: customer.id, flowGroupId: fg.id, quoteNumber: `QJG-${suffix}` },
    });
    const wt = await prisma.workflowTemplate.create({ data: { tenantId, templateKey: `TKJG-${suffix}`, displayName: "T" } });
    const wv = await prisma.workflowVersion.create({
      data: {
        workflowTemplateId: wt.id,
        versionNumber: 1,
        status: "PUBLISHED",
        publishedAt: new Date(),
        snapshotJson: { nodes: [{ id: "N1", type: "TASK" }] },
      },
    });
    const qv1Id = `qv-jbc-g-${suffix}`;
    const pkgV1 = {
      schemaVersion: "executionPackageSnapshot.v0",
      pinnedWorkflowVersionId: wv.id,
      slots: [
        {
          packageTaskId: "PT-G",
          nodeId: "N1",
          source: "SOLD_SCOPE",
          planTaskIds: ["PL-G"],
          displayTitle: "Gated",
          lineItemId: "L1",
        },
      ],
      skippedSkeletonSlotCount: 0,
    };
    const planV1 = {
      schemaVersion: "generatedPlanSnapshot.v0",
      quoteVersionId: qv1Id,
      rows: [{ planTaskId: "PL-G" }],
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
    const rt = await prisma.runtimeTask.create({
      data: {
        tenantId,
        flowId: flow1.id,
        packageTaskId: "PT-G",
        nodeId: "N1",
        quoteVersionId: qv1.id,
        lineItemId: "L1",
        planTaskIds: ["PL-G"],
        displayTitle: "Gated",
      },
    });

    const gate = await prisma.paymentGate.create({
      data: {
        tenantId,
        jobId: job.id,
        quoteVersionId: qv1.id,
        title: "Deposit (test)",
        status: "UNSATISFIED",
        targets: { create: { taskKind: "RUNTIME", taskId: rt.id } },
      },
    });

    try {
      const shell0 = await getJobShellReadModel(prisma, { tenantId, jobId: job.id });
      expect(shell0).not.toBeNull();
      const dto0 = toJobShellApiDto(shell0!);
      expect(dto0.paymentGates).toHaveLength(1);
      expect(dto0.paymentGates[0]).toMatchObject({
        id: gate.id,
        status: "UNSATISFIED",
        title: "Deposit (test)",
        targetCount: 1,
        satisfiedAt: null,
      });

      const sat = await satisfyPaymentGateForTenant(prisma, {
        tenantId,
        paymentGateId: gate.id,
        actorUserId: userId,
      });
      expect(sat.ok).toBe(true);

      const shell1 = await getJobShellReadModel(prisma, { tenantId, jobId: job.id });
      const dto1 = toJobShellApiDto(shell1!);
      expect(dto1.paymentGates[0].status).toBe("SATISFIED");
      expect(dto1.paymentGates[0].targetCount).toBe(1);
      expect(dto1.paymentGates[0].satisfiedAt).toBeTruthy();
      expect(new Date(dto1.paymentGates[0].satisfiedAt!).toISOString()).toBe(dto1.paymentGates[0].satisfiedAt);
    } finally {
      await prisma.paymentGateTarget.deleteMany({ where: { paymentGateId: gate.id } });
      await prisma.paymentGate.deleteMany({ where: { id: gate.id } });
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

  it("job-wide hold then task-scoped hold on DTO; release removes hold from activeOperationalHolds", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `jbc-h-${suffix}`;
    const userId = `user-jbc-h-${suffix}`;

    await prisma.tenant.create({ data: { id: tenantId, name: "JBC Hold", autoActivateOnSign: false } });
    await prisma.user.create({
      data: { id: userId, tenantId, email: `jbc-h-${suffix}@t.com`, role: "OFFICE_ADMIN" },
    });
    const customer = await prisma.customer.create({ data: { tenantId, name: "C" } });
    const fg = await prisma.flowGroup.create({ data: { tenantId, customerId: customer.id, name: "FG" } });
    const quote = await prisma.quote.create({
      data: { tenantId, customerId: customer.id, flowGroupId: fg.id, quoteNumber: `QJH-${suffix}` },
    });
    const wt = await prisma.workflowTemplate.create({ data: { tenantId, templateKey: `TKJH-${suffix}`, displayName: "T" } });
    const wv = await prisma.workflowVersion.create({
      data: {
        workflowTemplateId: wt.id,
        versionNumber: 1,
        status: "PUBLISHED",
        publishedAt: new Date(),
        snapshotJson: { nodes: [{ id: "N1", type: "TASK" }] },
      },
    });
    const qv1Id = `qv-jbc-h-${suffix}`;
    const pkgV1 = {
      schemaVersion: "executionPackageSnapshot.v0",
      pinnedWorkflowVersionId: wv.id,
      slots: [
        {
          packageTaskId: "PT-H",
          nodeId: "N1",
          source: "SOLD_SCOPE",
          planTaskIds: ["PL-H"],
          displayTitle: "H task",
          lineItemId: "L1",
        },
      ],
      skippedSkeletonSlotCount: 0,
    };
    const planV1 = {
      schemaVersion: "generatedPlanSnapshot.v0",
      quoteVersionId: qv1Id,
      rows: [{ planTaskId: "PL-H" }],
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
    const rt = await prisma.runtimeTask.create({
      data: {
        tenantId,
        flowId: flow1.id,
        packageTaskId: "PT-H",
        nodeId: "N1",
        quoteVersionId: qv1.id,
        lineItemId: "L1",
        planTaskIds: ["PL-H"],
        displayTitle: "H task",
      },
    });

    try {
      const hw = await createOperationalHoldForJob(prisma, {
        tenantId,
        jobId: job.id,
        createdById: userId,
        reason: "Job-wide pause",
      });
      const shell1 = await getJobShellReadModel(prisma, { tenantId, jobId: job.id });
      const dto1 = toJobShellApiDto(shell1!);
      expect(dto1.activeOperationalHolds).toHaveLength(1);
      expect(dto1.activeOperationalHolds[0]).toMatchObject({
        id: hw.id,
        runtimeTaskId: null,
        reason: "Job-wide pause",
      });

      await releaseHoldForTenant(prisma, { tenantId, holdId: hw.id, releasedById: userId });

      const hs = await createOperationalHoldForJob(prisma, {
        tenantId,
        jobId: job.id,
        createdById: userId,
        reason: "Task-only RFI",
        runtimeTaskId: rt.id,
      });

      const shell2 = await getJobShellReadModel(prisma, { tenantId, jobId: job.id });
      const dto2 = toJobShellApiDto(shell2!);
      expect(dto2.activeOperationalHolds).toHaveLength(1);
      expect(dto2.activeOperationalHolds[0]).toMatchObject({
        id: hs.id,
        runtimeTaskId: rt.id,
        reason: "Task-only RFI",
      });
      const taskRow = dto2.flows[0].runtimeTasks.find((t) => t.id === rt.id);
      expect(taskRow).toBeDefined();
      expect(taskRow!.actionability.start.reasons).toContain("HOLD_ACTIVE");

      await releaseHoldForTenant(prisma, { tenantId, holdId: hs.id, releasedById: userId });
      const shell3 = await getJobShellReadModel(prisma, { tenantId, jobId: job.id });
      const dto3 = toJobShellApiDto(shell3!);
      expect(dto3.activeOperationalHolds).toHaveLength(0);
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

  it("satisfyPaymentGateForTenant returns invalid_actor for user not in tenant (auth-adjacent guard)", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `jbc-a-${suffix}`;
    const userId = `user-jbc-a-${suffix}`;

    await prisma.tenant.create({ data: { id: tenantId, name: "JBC Actor", autoActivateOnSign: false } });
    await prisma.user.create({
      data: { id: userId, tenantId, email: `jbc-a-${suffix}@t.com`, role: "OFFICE_ADMIN" },
    });
    const customer = await prisma.customer.create({ data: { tenantId, name: "C" } });
    const fg = await prisma.flowGroup.create({ data: { tenantId, customerId: customer.id, name: "FG" } });
    const quote = await prisma.quote.create({
      data: { tenantId, customerId: customer.id, flowGroupId: fg.id, quoteNumber: `QJA-${suffix}` },
    });
    const qv = await prisma.quoteVersion.create({
      data: { quoteId: quote.id, versionNumber: 1, status: "SIGNED", createdById: userId },
    });
    const job = await prisma.job.create({ data: { tenantId, flowGroupId: fg.id } });
    const gate = await prisma.paymentGate.create({
      data: {
        tenantId,
        jobId: job.id,
        quoteVersionId: qv.id,
        title: "Gate",
        status: "UNSATISFIED",
      },
    });

    try {
      const badActor = `no-such-user-${suffix}`;
      const r = await satisfyPaymentGateForTenant(prisma, {
        tenantId,
        paymentGateId: gate.id,
        actorUserId: badActor,
      });
      expect(r.ok).toBe(false);
      if (r.ok) throw new Error("unexpected");
      expect(r.kind).toBe("invalid_actor");
    } finally {
      await prisma.paymentGate.deleteMany({ where: { id: gate.id } });
      await prisma.job.deleteMany({ where: { id: job.id } });
      await prisma.quoteVersion.deleteMany({ where: { quoteId: quote.id } });
      await prisma.quote.deleteMany({ where: { id: quote.id } });
      await prisma.flowGroup.deleteMany({ where: { id: fg.id } });
      await prisma.customer.deleteMany({ where: { id: customer.id } });
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }
  });

  it("createOperationalHoldForJob rejects runtimeTaskId not on job (matches POST body validation)", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `jbc-d-${suffix}`;
    const userId = `user-jbc-d-${suffix}`;

    await prisma.tenant.create({ data: { id: tenantId, name: "JBC Deny", autoActivateOnSign: false } });
    await prisma.user.create({
      data: { id: userId, tenantId, email: `jbc-d-${suffix}@t.com`, role: "OFFICE_ADMIN" },
    });
    const customer = await prisma.customer.create({ data: { tenantId, name: "C" } });
    const fg = await prisma.flowGroup.create({ data: { tenantId, customerId: customer.id, name: "FG" } });
    const job = await prisma.job.create({ data: { tenantId, flowGroupId: fg.id } });

    try {
      await expect(
        createOperationalHoldForJob(prisma, {
          tenantId,
          jobId: job.id,
          createdById: userId,
          reason: "Bad scope",
          runtimeTaskId: "rt_nonexistent_cuid",
        }),
      ).rejects.toMatchObject({ code: "HOLD_RUNTIME_TASK_NOT_ON_JOB" });
    } finally {
      await prisma.job.deleteMany({ where: { id: job.id } });
      await prisma.flowGroup.deleteMany({ where: { id: fg.id } });
      await prisma.customer.deleteMany({ where: { id: customer.id } });
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }
  });
});
