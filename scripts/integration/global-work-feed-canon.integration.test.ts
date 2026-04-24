import { describe, expect, it } from "vitest";
import { getPrisma } from "../../src/server/db/prisma";
import { getGlobalWorkFeedReadModelForTenant } from "../../src/server/slice1/reads/global-work-feed-reads";
import { sha256HexUtf8, canonicalStringify } from "../../src/server/slice1/compose-preview/freeze-snapshots";
import { createOperationalHoldForJob } from "../../src/server/slice1/mutations/hold-mutations";

/**
 * Execution Canon (Schema v5) regression tests for `getGlobalWorkFeedReadModelForTenant`:
 * see src/server/slice1/reads/global-work-feed-reads.ts (ACTIVE_FLOW + isNextForJob rules).
 *
 * Each `it` builds a self-contained tenant fixture and tears it down in `finally`.
 */
describe("global work feed — Execution Canon (Schema v5)", () => {
  it("ACTIVE_FLOW: with multiple candidate flows on one job, lex-max flow.id wins; older-flow runtime tasks are excluded", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `wf-active-${suffix}`;
    const userId = `user-active-${suffix}`;

    await prisma.tenant.create({ data: { id: tenantId, name: "Active flow T", autoActivateOnSign: false } });
    await prisma.user.create({
      data: { id: userId, tenantId, email: `active-${suffix}@t.com`, role: "OFFICE_ADMIN" },
    });
    const customer = await prisma.customer.create({ data: { tenantId, name: "C" } });
    const fg = await prisma.flowGroup.create({ data: { tenantId, customerId: customer.id, name: "FG" } });
    const quote = await prisma.quote.create({
      data: { tenantId, customerId: customer.id, flowGroupId: fg.id, quoteNumber: `QA-${suffix}` },
    });
    const wt = await prisma.workflowTemplate.create({
      data: { tenantId, templateKey: `TKA-${suffix}`, displayName: "T" },
    });
    const wv = await prisma.workflowVersion.create({
      data: {
        workflowTemplateId: wt.id,
        versionNumber: 1,
        status: "PUBLISHED",
        publishedAt: new Date(),
        snapshotJson: { nodes: [{ id: "N1", type: "TASK" }] },
      },
    });

    const pkg = {
      schemaVersion: "executionPackageSnapshot.v0",
      pinnedWorkflowVersionId: wv.id,
      slots: [
        {
          packageTaskId: "PT-OLD",
          nodeId: "N1",
          source: "SOLD_SCOPE",
          planTaskIds: ["PL-OLD"],
          displayTitle: "Old slot",
          lineItemId: "L1",
        },
      ],
      skippedSkeletonSlotCount: 0,
    };
    const planV1 = {
      schemaVersion: "generatedPlanSnapshot.v0",
      quoteVersionId: `qv-old-${suffix}`,
      rows: [{ planTaskId: "PL-OLD" }],
    };
    const qvOldId = `qv-old-${suffix}`;
    const qvOld = await prisma.quoteVersion.create({
      data: {
        id: qvOldId,
        quoteId: quote.id,
        versionNumber: 1,
        status: "SIGNED",
        createdById: userId,
        pinnedWorkflowVersionId: wv.id,
        executionPackageSnapshot: pkg,
        packageSnapshotSha256: sha256HexUtf8(canonicalStringify(pkg)),
        generatedPlanSnapshot: planV1,
        planSnapshotSha256: sha256HexUtf8(canonicalStringify(planV1)),
      },
    });

    const planV2Pkg = {
      schemaVersion: "executionPackageSnapshot.v0",
      pinnedWorkflowVersionId: wv.id,
      slots: [
        {
          packageTaskId: "PT-NEW",
          nodeId: "N1",
          source: "SOLD_SCOPE",
          planTaskIds: ["PL-NEW"],
          displayTitle: "New slot",
          lineItemId: "L1",
        },
      ],
      skippedSkeletonSlotCount: 0,
    };
    const planV2 = {
      schemaVersion: "generatedPlanSnapshot.v0",
      quoteVersionId: `qv-new-${suffix}`,
      rows: [{ planTaskId: "PL-NEW" }],
    };
    const qvNewId = `qv-new-${suffix}`;
    const qvNew = await prisma.quoteVersion.create({
      data: {
        id: qvNewId,
        quoteId: quote.id,
        versionNumber: 2,
        status: "SIGNED",
        createdById: userId,
        pinnedWorkflowVersionId: wv.id,
        executionPackageSnapshot: planV2Pkg,
        packageSnapshotSha256: sha256HexUtf8(canonicalStringify(planV2Pkg)),
        generatedPlanSnapshot: planV2,
        planSnapshotSha256: sha256HexUtf8(canonicalStringify(planV2)),
      },
    });

    const job = await prisma.job.create({ data: { tenantId, flowGroupId: fg.id } });

    // Two flows on the same job; deterministic lex order via explicit ids.
    const flowAaaId = `flow-aaa-${suffix}`;
    const flowZzzId = `flow-zzz-${suffix}`;
    const flowAaa = await prisma.flow.create({
      data: { id: flowAaaId, tenantId, jobId: job.id, quoteVersionId: qvOld.id, workflowVersionId: wv.id },
    });
    const flowZzz = await prisma.flow.create({
      data: { id: flowZzzId, tenantId, jobId: job.id, quoteVersionId: qvNew.id, workflowVersionId: wv.id },
    });
    await prisma.activation.create({
      data: {
        tenantId,
        jobId: job.id,
        flowId: flowAaa.id,
        quoteVersionId: qvOld.id,
        packageSnapshotSha256: qvOld.packageSnapshotSha256!,
        activatedById: userId,
      },
    });
    await prisma.activation.create({
      data: {
        tenantId,
        jobId: job.id,
        flowId: flowZzz.id,
        quoteVersionId: qvNew.id,
        packageSnapshotSha256: qvNew.packageSnapshotSha256!,
        activatedById: userId,
      },
    });

    const rtOld = await prisma.runtimeTask.create({
      data: {
        tenantId,
        flowId: flowAaa.id,
        packageTaskId: "PT-OLD",
        nodeId: "N1",
        quoteVersionId: qvOld.id,
        lineItemId: "L1",
        planTaskIds: ["PL-OLD"],
        displayTitle: "Old slot",
      },
    });
    const rtNew = await prisma.runtimeTask.create({
      data: {
        tenantId,
        flowId: flowZzz.id,
        packageTaskId: "PT-NEW",
        nodeId: "N1",
        quoteVersionId: qvNew.id,
        lineItemId: "L1",
        planTaskIds: ["PL-NEW"],
        displayTitle: "New slot",
      },
    });

    try {
      const feed = await getGlobalWorkFeedReadModelForTenant(prisma, { tenantId });
      expect(feed.schemaVersion).toBe(5);
      const ids = feed.rows.map((r) => r.runtimeTaskId).sort();
      expect(ids).toEqual([rtNew.id]);
      expect(ids).not.toContain(rtOld.id);
    } finally {
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

  it("excludes superseded RuntimeTasks; preJobRows and skeletonRows are always empty; accepted rows are excluded; blocked rows appear; isNextForJob picks first eligible in frozen package order", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `wf-canon-${suffix}`;
    const userId = `user-canon-${suffix}`;

    await prisma.tenant.create({ data: { id: tenantId, name: "Canon T", autoActivateOnSign: false } });
    await prisma.user.create({
      data: { id: userId, tenantId, email: `canon-${suffix}@t.com`, role: "OFFICE_ADMIN" },
    });
    const customer = await prisma.customer.create({ data: { tenantId, name: "C" } });
    const fg = await prisma.flowGroup.create({ data: { tenantId, customerId: customer.id, name: "FG" } });
    const quote = await prisma.quote.create({
      data: { tenantId, customerId: customer.id, flowGroupId: fg.id, quoteNumber: `QC-${suffix}` },
    });
    const wt = await prisma.workflowTemplate.create({
      data: { tenantId, templateKey: `TKC-${suffix}`, displayName: "T" },
    });
    const wv = await prisma.workflowVersion.create({
      data: {
        workflowTemplateId: wt.id,
        versionNumber: 1,
        status: "PUBLISHED",
        publishedAt: new Date(),
        snapshotJson: { nodes: [{ id: "N1", type: "TASK" }, { id: "N2", type: "TASK" }, { id: "N3", type: "TASK" }] },
      },
    });

    // Frozen package order: PT-A (blocked by task hold), PT-B (next), PT-C (also startable but later in order).
    const pkg = {
      schemaVersion: "executionPackageSnapshot.v0",
      pinnedWorkflowVersionId: wv.id,
      slots: [
        { packageTaskId: "PT-A", nodeId: "N1", source: "SOLD_SCOPE", planTaskIds: ["PL-A"], displayTitle: "A", lineItemId: "L1" },
        { packageTaskId: "PT-B", nodeId: "N2", source: "SOLD_SCOPE", planTaskIds: ["PL-B"], displayTitle: "B", lineItemId: "L2" },
        { packageTaskId: "PT-C", nodeId: "N3", source: "SOLD_SCOPE", planTaskIds: ["PL-C"], displayTitle: "C", lineItemId: "L3" },
        { packageTaskId: "PT-ACCEPTED", nodeId: "N1", source: "SOLD_SCOPE", planTaskIds: ["PL-X"], displayTitle: "Accepted", lineItemId: "L1" },
        { packageTaskId: "PT-SUPERSEDED", nodeId: "N1", source: "SOLD_SCOPE", planTaskIds: ["PL-Y"], displayTitle: "Superseded", lineItemId: "L1" },
      ],
      skippedSkeletonSlotCount: 0,
    };
    const plan = {
      schemaVersion: "generatedPlanSnapshot.v0",
      quoteVersionId: `qv-canon-${suffix}`,
      rows: [{ planTaskId: "PL-A" }, { planTaskId: "PL-B" }, { planTaskId: "PL-C" }, { planTaskId: "PL-X" }, { planTaskId: "PL-Y" }],
    };
    const qvId = `qv-canon-${suffix}`;
    const qv = await prisma.quoteVersion.create({
      data: {
        id: qvId,
        quoteId: quote.id,
        versionNumber: 1,
        status: "SIGNED",
        createdById: userId,
        pinnedWorkflowVersionId: wv.id,
        executionPackageSnapshot: pkg,
        packageSnapshotSha256: sha256HexUtf8(canonicalStringify(pkg)),
        generatedPlanSnapshot: plan,
        planSnapshotSha256: sha256HexUtf8(canonicalStringify(plan)),
      },
    });
    const job = await prisma.job.create({ data: { tenantId, flowGroupId: fg.id } });
    const flow = await prisma.flow.create({
      data: { tenantId, jobId: job.id, quoteVersionId: qv.id, workflowVersionId: wv.id },
    });
    await prisma.activation.create({
      data: {
        tenantId,
        jobId: job.id,
        flowId: flow.id,
        quoteVersionId: qv.id,
        packageSnapshotSha256: qv.packageSnapshotSha256!,
        activatedById: userId,
      },
    });

    const rtA = await prisma.runtimeTask.create({
      data: {
        tenantId, flowId: flow.id, packageTaskId: "PT-A", nodeId: "N1",
        quoteVersionId: qv.id, lineItemId: "L1", planTaskIds: ["PL-A"], displayTitle: "A",
      },
    });
    const rtB = await prisma.runtimeTask.create({
      data: {
        tenantId, flowId: flow.id, packageTaskId: "PT-B", nodeId: "N2",
        quoteVersionId: qv.id, lineItemId: "L2", planTaskIds: ["PL-B"], displayTitle: "B",
      },
    });
    const rtC = await prisma.runtimeTask.create({
      data: {
        tenantId, flowId: flow.id, packageTaskId: "PT-C", nodeId: "N3",
        quoteVersionId: qv.id, lineItemId: "L3", planTaskIds: ["PL-C"], displayTitle: "C",
      },
    });
    const rtAccepted = await prisma.runtimeTask.create({
      data: {
        tenantId, flowId: flow.id, packageTaskId: "PT-ACCEPTED", nodeId: "N1",
        quoteVersionId: qv.id, lineItemId: "L1", planTaskIds: ["PL-X"], displayTitle: "Accepted",
      },
    });
    // Mark rtAccepted as accepted via STARTED + COMPLETED + REVIEW_ACCEPTED events.
    const baseTs = new Date();
    await prisma.taskExecution.create({
      data: {
        tenantId, flowId: flow.id, taskKind: "RUNTIME", runtimeTaskId: rtAccepted.id,
        eventType: "STARTED", actorUserId: userId, createdAt: new Date(baseTs.getTime() - 30_000),
      },
    });
    await prisma.taskExecution.create({
      data: {
        tenantId, flowId: flow.id, taskKind: "RUNTIME", runtimeTaskId: rtAccepted.id,
        eventType: "COMPLETED", actorUserId: userId, createdAt: new Date(baseTs.getTime() - 20_000),
      },
    });
    await prisma.taskExecution.create({
      data: {
        tenantId, flowId: flow.id, taskKind: "RUNTIME", runtimeTaskId: rtAccepted.id,
        eventType: "REVIEW_ACCEPTED", actorUserId: userId, createdAt: new Date(baseTs.getTime() - 10_000),
      },
    });

    // Superseded RT (uses a real ChangeOrder row via FK).
    const co = await prisma.changeOrder.create({
      data: {
        tenantId, jobId: job.id, reason: "test supersede",
        status: "APPLIED", createdById: userId, appliedAt: new Date(), appliedById: userId,
      },
    });
    const rtSuperseded = await prisma.runtimeTask.create({
      data: {
        tenantId, flowId: flow.id, packageTaskId: "PT-SUPERSEDED", nodeId: "N1",
        quoteVersionId: qv.id, lineItemId: "L1", planTaskIds: ["PL-Y"], displayTitle: "Superseded",
        changeOrderIdSuperseded: co.id,
      },
    });

    // Pre-job task — must NOT appear in feed under canon.
    const preJob = await prisma.preJobTask.create({
      data: {
        tenantId, flowGroupId: fg.id, taskType: "SITE_WALK", sourceType: "OFFICE",
        title: "Walk", status: "OPEN", createdById: userId,
      },
    });

    // Task-scoped hold on rtA only — blocks PT-A so canon "next" should pick PT-B (next in package order).
    const taskHold = await createOperationalHoldForJob(prisma, {
      tenantId, jobId: job.id, createdById: userId, reason: "Task A on hold", runtimeTaskId: rtA.id,
    });

    try {
      const feed = await getGlobalWorkFeedReadModelForTenant(prisma, { tenantId });

      expect(feed.schemaVersion).toBe(5);

      // No skeleton or pre-job leakage into execution feed.
      expect(feed.preJobRows).toEqual([]);
      expect(feed.skeletonRows).toEqual([]);
      expect(feed.preJobTruncated).toBe(false);
      expect(feed.skeletonFlowScanTruncated).toBe(false);
      expect(feed.skeletonRowsTruncated).toBe(false);

      const idsInFeed = feed.rows.map((r) => r.runtimeTaskId).sort();
      // rtAccepted excluded (accepted), rtSuperseded excluded (changeOrderIdSuperseded set).
      expect(idsInFeed.sort()).toEqual([rtA.id, rtB.id, rtC.id].sort());
      expect(idsInFeed).not.toContain(rtAccepted.id);
      expect(idsInFeed).not.toContain(rtSuperseded.id);

      const rowA = feed.rows.find((r) => r.runtimeTaskId === rtA.id)!;
      const rowB = feed.rows.find((r) => r.runtimeTaskId === rtB.id)!;
      const rowC = feed.rows.find((r) => r.runtimeTaskId === rtC.id)!;
      expect(rowA.lane).toBe("blocked");
      expect(rowA.actionability.start.reasons).toContain("HOLD_ACTIVE");

      // isNextForJob: PT-A blocked by hold → not next; PT-B is the first eligible in frozen order.
      expect(rowA.isNextForJob).toBe(false);
      expect(rowB.isNextForJob).toBe(true);
      expect(rowC.isNextForJob).toBe(false);
      // At most one row per job has isNextForJob === true.
      const nextCount = feed.rows.filter((r) => r.isNextForJob).length;
      expect(nextCount).toBe(1);

      // packageTaskId is exposed on rows for deterministic ordering.
      expect(rowA.packageTaskId).toBe("PT-A");
      expect(rowB.packageTaskId).toBe("PT-B");
      expect(rowC.packageTaskId).toBe("PT-C");

      void preJob;
      void taskHold;
    } finally {
      await prisma.hold.deleteMany({ where: { tenantId } });
      await prisma.taskExecution.deleteMany({ where: { tenantId } });
      await prisma.runtimeTask.deleteMany({ where: { tenantId } });
      await prisma.changeOrder.deleteMany({ where: { tenantId } });
      await prisma.activation.deleteMany({ where: { jobId: job.id } });
      await prisma.flow.deleteMany({ where: { jobId: job.id } });
      await prisma.preJobTask.deleteMany({ where: { tenantId } });
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

  it("returns empty rows when tenant has no active execution flow (no candidate flows)", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `wf-empty-${suffix}`;
    const userId = `user-empty-${suffix}`;

    await prisma.tenant.create({ data: { id: tenantId, name: "Empty T", autoActivateOnSign: false } });
    await prisma.user.create({
      data: { id: userId, tenantId, email: `empty-${suffix}@t.com`, role: "OFFICE_ADMIN" },
    });
    // Create a PreJobTask only — must produce a fully empty feed under canon.
    const customer = await prisma.customer.create({ data: { tenantId, name: "C" } });
    const fg = await prisma.flowGroup.create({ data: { tenantId, customerId: customer.id, name: "FG" } });
    await prisma.preJobTask.create({
      data: {
        tenantId, flowGroupId: fg.id, taskType: "OTHER", sourceType: "OFFICE",
        title: "Pre", status: "OPEN", createdById: userId,
      },
    });

    try {
      const feed = await getGlobalWorkFeedReadModelForTenant(prisma, { tenantId });
      expect(feed.schemaVersion).toBe(5);
      expect(feed.rows).toEqual([]);
      expect(feed.preJobRows).toEqual([]);
      expect(feed.skeletonRows).toEqual([]);
      expect(feed.runtimeTruncated).toBe(false);
    } finally {
      await prisma.preJobTask.deleteMany({ where: { tenantId } });
      await prisma.flowGroup.deleteMany({ where: { id: fg.id } });
      await prisma.customer.deleteMany({ where: { id: customer.id } });
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }
  });
});
