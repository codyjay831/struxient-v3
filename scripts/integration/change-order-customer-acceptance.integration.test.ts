import { describe, expect, it } from "vitest";
import { getPrisma } from "../../src/server/db/prisma";
import { createChangeOrderForJob } from "../../src/server/slice1/mutations/create-change-order";
import { applyChangeOrderForJob } from "../../src/server/slice1/mutations/apply-change-order";
import { sendQuoteVersionForTenant } from "../../src/server/slice1/mutations/send-quote-version";
import { signQuoteVersionViaPortalShareToken } from "../../src/server/slice1/mutations/sign-quote-version-via-portal";
import { startRuntimeTaskForTenant } from "../../src/server/slice1/mutations/runtime-task-execution";
import { getQuotePortalPresentationByShareToken } from "../../src/server/slice1/reads/quote-portal-reads";
import { createQuoteLineItemForTenant } from "../../src/server/slice1/mutations/quote-line-item-mutations";
import { sha256HexUtf8, canonicalStringify } from "../../src/server/slice1/compose-preview/freeze-snapshots";

/**
 * Epic 37: customer-facing CO acceptance via existing quote portal + send/sign invariants.
 */
describe("change order customer acceptance (send / portal / sign)", () => {
  it("send CO draft sets PENDING_CUSTOMER; portal shows reason; sign → READY_TO_APPLY; then apply succeeds", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `co37-${suffix}`;
    const userId = `user-co37-${suffix}`;

    await prisma.tenant.create({ data: { id: tenantId, name: "CO37", autoActivateOnSign: false } });
    await prisma.user.create({
      data: { id: userId, tenantId, email: `co37-${suffix}@t.com`, role: "OFFICE_ADMIN" },
    });
    const customer = await prisma.customer.create({ data: { tenantId, name: "Cust" } });
    const fg = await prisma.flowGroup.create({ data: { tenantId, customerId: customer.id, name: "FG" } });
    const quote = await prisma.quote.create({
      data: { tenantId, customerId: customer.id, flowGroupId: fg.id, quoteNumber: `QCO37-${suffix}` },
    });
    const wt = await prisma.workflowTemplate.create({ data: { tenantId, templateKey: `TK-${suffix}`, displayName: "T" } });
    const wv = await prisma.workflowVersion.create({
      data: {
        workflowTemplateId: wt.id,
        versionNumber: 1,
        status: "PUBLISHED",
        publishedAt: new Date(),
        snapshotJson: { nodes: [{ id: "N1", type: "TASK" }, { id: "N2", type: "TASK" }] },
      },
    });

    const qv1Id = `qv1-${suffix}`;
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
      rows: [{ planTaskId: "PL-A", title: "Task A row", lineItemId: "L1" }],
    };

    const qv1 = await prisma.quoteVersion.create({
      data: {
        id: qv1Id,
        quoteId: quote.id,
        versionNumber: 1,
        status: "DRAFT",
        createdById: userId,
        pinnedWorkflowVersionId: wv.id,
      },
    });

    const group = await prisma.proposalGroup.create({
      data: { quoteVersionId: qv1.id, name: "G", sortOrder: 0 },
    });
    const lp = await prisma.quoteLocalPacket.create({
      data: {
        tenantId,
        quoteVersionId: qv1.id,
        displayName: "LP",
        originType: "MANUAL_LOCAL",
        createdById: userId,
      },
    });
    await prisma.quoteLocalPacketItem.create({
      data: {
        quoteLocalPacketId: lp.id,
        lineKey: "lk1",
        sortOrder: 0,
        lineKind: "EMBEDDED",
        targetNodeKey: "N1",
        embeddedPayloadJson: { title: "CO37 line", taskKind: "LABOR" },
      },
    });
    const line = await createQuoteLineItemForTenant(prisma, {
      tenantId,
      quoteVersionId: qv1.id,
      proposalGroupId: group.id,
      sortOrder: 0,
      quantity: 1,
      executionMode: "MANIFEST",
      title: "Line",
      quoteLocalPacketId: lp.id,
    });
    if (line === "not_found") throw new Error("unexpected");

    await prisma.quoteVersion.update({
      where: { id: qv1.id },
      data: {
        status: "SIGNED",
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
    await startRuntimeTaskForTenant(prisma, {
      tenantId,
      runtimeTaskId: rtA.id,
      actorUserId: userId,
      request: {},
    });

    const coResult = await createChangeOrderForJob(prisma, {
      tenantId,
      jobId: job.id,
      reason: "Add scope for customer sign-off",
      createdById: userId,
    });
    expect(coResult.ok).toBe(true);
    if (!coResult.ok) throw new Error("co");
    const coId = coResult.data.changeOrderId;
    const qv2Id = coResult.data.draftQuoteVersionId;

    const pkgV2 = {
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
        {
          packageTaskId: "PT-B",
          nodeId: "N2",
          source: "SOLD_SCOPE",
          planTaskIds: ["PL-B"],
          displayTitle: "Task B",
          lineItemId: "L2",
        },
      ],
      skippedSkeletonSlotCount: 0,
    };
    const planV2 = {
      schemaVersion: "generatedPlanSnapshot.v0",
      quoteVersionId: qv2Id,
      rows: [
        { planTaskId: "PL-A", title: "Task A row", lineItemId: "L1" },
        { planTaskId: "PL-B", title: "Task B row", lineItemId: "L2" },
      ],
    };
    await prisma.quoteVersion.update({
      where: { id: qv2Id },
      data: {
        executionPackageSnapshot: pkgV2,
        packageSnapshotSha256: sha256HexUtf8(canonicalStringify(pkgV2)),
        generatedPlanSnapshot: planV2,
        planSnapshotSha256: sha256HexUtf8(canonicalStringify(planV2)),
      },
    });

    try {
      const tokRow = await prisma.quoteVersion.findUniqueOrThrow({
        where: { id: qv2Id },
        select: { composePreviewStalenessToken: true },
      });
      const send = await sendQuoteVersionForTenant(prisma, {
        tenantId,
        quoteVersionId: qv2Id,
        sentByUserId: userId,
        request: { clientStalenessToken: tokRow.composePreviewStalenessToken ?? null },
      });
      expect(send.ok).toBe(true);
      if (!send.ok) throw new Error("send failed");
      const portalToken = send.data.portalQuoteShareToken!;
      expect(portalToken).toBeTruthy();

      const coRow = await prisma.changeOrder.findUniqueOrThrow({ where: { id: coId } });
      expect(coRow.status).toBe("PENDING_CUSTOMER");

      const portalModel = await getQuotePortalPresentationByShareToken(prisma, { shareToken: portalToken });
      expect(portalModel).not.toBeNull();
      expect(portalModel!.changeOrderSummary?.reason).toBe("Add scope for customer sign-off");

      const blocked = await applyChangeOrderForJob(prisma, {
        tenantId,
        changeOrderId: coId,
        appliedByUserId: userId,
      });
      expect(blocked.ok).toBe(false);
      if (blocked.ok) throw new Error("expected block");
      expect(blocked.kind).toBe("invalid_status");

      const sign = await signQuoteVersionViaPortalShareToken(prisma, {
        shareToken: portalToken,
        request: {
          signerName: "Pat Customer",
          signerEmail: "pat@example.com",
          acceptTerms: true,
        },
      });
      expect(sign.ok).toBe(true);

      const coAfter = await prisma.changeOrder.findUniqueOrThrow({ where: { id: coId } });
      expect(coAfter.status).toBe("READY_TO_APPLY");

      const applied = await applyChangeOrderForJob(prisma, {
        tenantId,
        changeOrderId: coId,
        appliedByUserId: userId,
      });
      expect(applied.ok).toBe(true);
    } finally {
      await prisma.paymentGateTarget.deleteMany({ where: { paymentGate: { jobId: job.id } } });
      await prisma.paymentGate.deleteMany({ where: { jobId: job.id } });
      await prisma.taskExecution.deleteMany({ where: { tenantId } });
      await prisma.runtimeTask.deleteMany({ where: { tenantId } });
      await prisma.activation.deleteMany({ where: { jobId: job.id } });
      await prisma.flow.deleteMany({ where: { jobId: job.id } });
      await prisma.changeOrder.deleteMany({ where: { jobId: job.id } });
      await prisma.quoteSignature.deleteMany({ where: { tenantId } });
      await prisma.auditEvent.deleteMany({ where: { tenantId } });
      await prisma.quoteLineItem.deleteMany({ where: { quoteVersion: { quoteId: quote.id } } });
      await prisma.quoteLocalPacketItem.deleteMany({ where: { quoteLocalPacket: { tenantId } } });
      await prisma.quoteLocalPacket.deleteMany({ where: { tenantId } });
      await prisma.proposalGroup.deleteMany({ where: { quoteVersion: { quoteId: quote.id } } });
      await prisma.quoteVersion.deleteMany({ where: { quoteId: quote.id } });
      await prisma.quote.deleteMany({ where: { id: quote.id } });
      await prisma.job.deleteMany({ where: { id: job.id } });
      await prisma.flowGroup.deleteMany({ where: { id: fg.id } });
      await prisma.customer.deleteMany({ where: { id: customer.id } });
      await prisma.workflowVersion.deleteMany({ where: { workflowTemplateId: wt.id } });
      await prisma.workflowTemplate.deleteMany({ where: { id: wt.id } });
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }
  });

  it("regression: DRAFT change order with signed draft quote still applies (no customer path)", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `co37r-${suffix}`;
    const userId = `user-co37r-${suffix}`;

    await prisma.tenant.create({ data: { id: tenantId, name: "CO37R", autoActivateOnSign: false } });
    await prisma.user.create({
      data: { id: userId, tenantId, email: `co37r-${suffix}@t.com`, role: "OFFICE_ADMIN" },
    });
    const customer = await prisma.customer.create({ data: { tenantId, name: "C" } });
    const fg = await prisma.flowGroup.create({ data: { tenantId, customerId: customer.id, name: "FG" } });
    const quote = await prisma.quote.create({
      data: { tenantId, customerId: customer.id, flowGroupId: fg.id, quoteNumber: `R-${suffix}` },
    });
    const wt = await prisma.workflowTemplate.create({ data: { tenantId, templateKey: `TKR-${suffix}`, displayName: "T" } });
    const wv = await prisma.workflowVersion.create({
      data: {
        workflowTemplateId: wt.id,
        versionNumber: 1,
        status: "PUBLISHED",
        publishedAt: new Date(),
        snapshotJson: { nodes: [{ id: "N1", type: "TASK" }, { id: "N2", type: "TASK" }] },
      },
    });
    const qv1Id = `qv1r-${suffix}`;
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
    await startRuntimeTaskForTenant(prisma, {
      tenantId,
      runtimeTaskId: rtA.id,
      actorUserId: userId,
      request: {},
    });

    const coResult = await createChangeOrderForJob(prisma, {
      tenantId,
      jobId: job.id,
      reason: "Legacy apply",
      createdById: userId,
    });
    expect(coResult.ok).toBe(true);
    if (!coResult.ok) throw new Error("co");
    const coId = coResult.data.changeOrderId;
    const qv2Id = coResult.data.draftQuoteVersionId;

    const pkgV2 = {
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
        {
          packageTaskId: "PT-B",
          nodeId: "N2",
          source: "SOLD_SCOPE",
          planTaskIds: ["PL-B"],
          displayTitle: "Task B",
          lineItemId: "L2",
        },
      ],
      skippedSkeletonSlotCount: 0,
    };
    const planV2 = {
      schemaVersion: "generatedPlanSnapshot.v0",
      quoteVersionId: qv2Id,
      rows: [{ planTaskId: "PL-A" }, { planTaskId: "PL-B" }],
    };
    await prisma.quoteVersion.update({
      where: { id: qv2Id },
      data: {
        status: "SIGNED",
        executionPackageSnapshot: pkgV2,
        packageSnapshotSha256: sha256HexUtf8(canonicalStringify(pkgV2)),
        generatedPlanSnapshot: planV2,
        planSnapshotSha256: sha256HexUtf8(canonicalStringify(planV2)),
      },
    });

    try {
      const coRow = await prisma.changeOrder.findUniqueOrThrow({ where: { id: coId } });
      expect(coRow.status).toBe("DRAFT");

      const applied = await applyChangeOrderForJob(prisma, {
        tenantId,
        changeOrderId: coId,
        appliedByUserId: userId,
      });
      expect(applied.ok).toBe(true);
    } finally {
      await prisma.taskExecution.deleteMany({ where: { tenantId } });
      await prisma.runtimeTask.deleteMany({ where: { tenantId } });
      await prisma.activation.deleteMany({ where: { jobId: job.id } });
      await prisma.flow.deleteMany({ where: { jobId: job.id } });
      await prisma.changeOrder.deleteMany({ where: { jobId: job.id } });
      await prisma.quoteVersion.deleteMany({ where: { quoteId: quote.id } });
      await prisma.quote.deleteMany({ where: { id: quote.id } });
      await prisma.job.deleteMany({ where: { id: job.id } });
      await prisma.flowGroup.deleteMany({ where: { id: fg.id } });
      await prisma.customer.deleteMany({ where: { id: customer.id } });
      await prisma.workflowVersion.deleteMany({ where: { workflowTemplateId: wt.id } });
      await prisma.workflowTemplate.deleteMany({ where: { id: wt.id } });
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }
  });
});
