import { describe, expect, it } from "vitest";
import { getPrisma } from "../../src/server/db/prisma";
import { getQuotePortalPresentationByShareToken } from "../../src/server/slice1/reads/quote-portal-reads";
import { getQuoteWorkspaceForTenant } from "../../src/server/slice1/reads/quote-workspace-reads";
import { declineQuoteVersionViaPortalShareToken } from "../../src/server/slice1/mutations/decline-quote-version-via-portal";
import { sendQuoteVersionForTenant } from "../../src/server/slice1/mutations/send-quote-version";
import { createChangeOrderForJob } from "../../src/server/slice1/mutations/create-change-order";
import { startRuntimeTaskForTenant } from "../../src/server/slice1/mutations/runtime-task-execution";
import { canonicalStringify, sha256HexUtf8 } from "../../src/server/slice1/compose-preview/freeze-snapshots";
import {
  createWorkflowTemplateForTenant,
  createWorkflowVersionDraftForTenant,
  publishWorkflowVersionForTenant,
  replaceWorkflowVersionDraftSnapshotForTenant,
  setPinnedWorkflowVersionForTenant,
} from "../../src/server/slice1";
import { createQuoteLineItemForTenant } from "../../src/server/slice1/mutations/quote-line-item-mutations";

describe("Epic 13 + 54 portal quote decline", () => {
  it("persists DECLINED + reason, audit event, and portal read model", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `pd-${suffix}`;
    const userId = `user-pd-${suffix}`;

    await prisma.tenant.create({ data: { id: tenantId, name: "PD", autoActivateOnSign: false } });
    await prisma.user.create({
      data: { id: userId, tenantId, email: `pd-${suffix}@t.com`, role: "OFFICE_ADMIN" },
    });
    const customer = await prisma.customer.create({ data: { tenantId, name: "Cust" } });
    const fg = await prisma.flowGroup.create({ data: { tenantId, customerId: customer.id, name: "FG" } });
    const quote = await prisma.quote.create({
      data: { tenantId, customerId: customer.id, flowGroupId: fg.id, quoteNumber: `QPD-${suffix}` },
    });
    const qv = await prisma.quoteVersion.create({
      data: { quoteId: quote.id, versionNumber: 1, status: "DRAFT", createdById: userId },
    });
    const group = await prisma.proposalGroup.create({
      data: { quoteVersionId: qv.id, name: "G", sortOrder: 0 },
    });

    let tmplId: string | null = null;

    try {
      const tmpl = await createWorkflowTemplateForTenant(prisma, {
        tenantId,
        templateKey: `pd-tk-${suffix}`,
        displayName: "T",
      });
      tmplId = tmpl.id;
      const draft = await createWorkflowVersionDraftForTenant(prisma, {
        tenantId,
        workflowTemplateId: tmpl.id,
      });
      if (draft === "not_found") throw new Error("unexpected");
      await replaceWorkflowVersionDraftSnapshotForTenant(prisma, {
        tenantId,
        workflowVersionId: draft.id,
        snapshotJson: { nodes: [{ id: "install", type: "TASK" }] },
      });
      const pub = await publishWorkflowVersionForTenant(prisma, {
        tenantId,
        workflowVersionId: draft.id,
        userId,
      });
      if (pub === "not_found") throw new Error("unexpected");
      const pin = await setPinnedWorkflowVersionForTenant(prisma, {
        tenantId,
        quoteVersionId: qv.id,
        pinnedWorkflowVersionId: draft.id,
      });
      if (pin === "not_found") throw new Error("unexpected");

      const localPacket = await prisma.quoteLocalPacket.create({
        data: {
          tenantId,
          quoteVersionId: qv.id,
          displayName: "LP",
          originType: "MANUAL_LOCAL",
          createdById: userId,
        },
      });
      await prisma.quoteLocalPacketItem.create({
        data: {
          quoteLocalPacketId: localPacket.id,
          lineKey: "lk1",
          sortOrder: 0,
          lineKind: "EMBEDDED",
          targetNodeKey: "install",
          embeddedPayloadJson: { title: "Decline-visible task", taskKind: "LABOR" },
        },
      });
      const line = await createQuoteLineItemForTenant(prisma, {
        tenantId,
        quoteVersionId: qv.id,
        proposalGroupId: group.id,
        sortOrder: 0,
        quantity: 1,
        executionMode: "MANIFEST",
        title: "M",
        quoteLocalPacketId: localPacket.id,
      });
      if (line === "not_found") throw new Error("unexpected");

      const tokRow = await prisma.quoteVersion.findUniqueOrThrow({
        where: { id: qv.id },
        select: { composePreviewStalenessToken: true },
      });
      const send = await sendQuoteVersionForTenant(prisma, {
        tenantId,
        quoteVersionId: qv.id,
        sentByUserId: userId,
        request: { clientStalenessToken: tokRow.composePreviewStalenessToken ?? null },
      });
      expect(send.ok).toBe(true);
      if (!send.ok) throw new Error("send failed");
      const token = send.data.portalQuoteShareToken!;

      const portalBefore = await getQuotePortalPresentationByShareToken(prisma, { shareToken: token });
      expect(portalBefore?.status).toBe("SENT");

      const decline = await declineQuoteVersionViaPortalShareToken(prisma, {
        shareToken: token,
        request: { declineReason: "  Scope does not include permits we need.  " },
      });
      expect(decline.ok).toBe(true);
      if (!decline.ok) throw new Error("decline failed");
      expect(decline.data.idempotentReplay).toBe(false);

      const row = await prisma.quoteVersion.findUniqueOrThrow({
        where: { id: qv.id },
        select: { status: true, portalDeclinedAt: true, portalDeclineReason: true },
      });
      expect(row.status).toBe("DECLINED");
      expect(row.portalDeclineReason).toBe("Scope does not include permits we need.");
      expect(row.portalDeclinedAt).toBeTruthy();

      const audit = await prisma.auditEvent.findFirst({
        where: { tenantId, eventType: "QUOTE_VERSION_DECLINED_PORTAL", targetQuoteVersionId: qv.id },
      });
      expect(audit).toBeTruthy();

      const portalAfter = await getQuotePortalPresentationByShareToken(prisma, { shareToken: token });
      expect(portalAfter?.status).toBe("DECLINED");
      expect(portalAfter?.portalDeclineReason).toBe(row.portalDeclineReason);

      const again = await declineQuoteVersionViaPortalShareToken(prisma, {
        shareToken: token,
        request: { declineReason: "ignored on replay" },
      });
      expect(again.ok).toBe(true);
      if (!again.ok) throw new Error("replay failed");
      expect(again.data.idempotentReplay).toBe(true);
    } finally {
      await prisma.quotePortalShareDelivery.deleteMany({ where: { tenantId } });
      await prisma.auditEvent.deleteMany({ where: { tenantId } });
      await prisma.job.deleteMany({ where: { tenantId } });
      await prisma.quoteVersion.deleteMany({ where: { quoteId: quote.id } });
      await prisma.quote.deleteMany({ where: { id: quote.id } });
      if (tmplId) {
        await prisma.workflowVersion.deleteMany({ where: { workflowTemplateId: tmplId } });
        await prisma.workflowTemplate.deleteMany({ where: { id: tmplId } });
      }
      await prisma.flowGroup.deleteMany({ where: { id: fg.id } });
      await prisma.customer.deleteMany({ where: { id: customer.id } });
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }
  });

  /**
   * Cross-entity: portal decline voids PENDING_CUSTOMER CO; workspace read exposes draft decline metadata on that CO.
   * Fixture pattern aligned with `change-order-customer-acceptance.integration.test.ts` (minimal job + activated v1 + CO draft v2 send).
   */
  it("voids PENDING_CUSTOMER change order and workspace read exposes decline metadata on the CO row", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `pdco-${suffix}`;
    const userId = `user-pdco-${suffix}`;

    await prisma.tenant.create({ data: { id: tenantId, name: "PDCO", autoActivateOnSign: false } });
    await prisma.user.create({
      data: { id: userId, tenantId, email: `pdco-${suffix}@t.com`, role: "OFFICE_ADMIN" },
    });
    const customer = await prisma.customer.create({ data: { tenantId, name: "Cust" } });
    const fg = await prisma.flowGroup.create({ data: { tenantId, customerId: customer.id, name: "FG" } });
    const quote = await prisma.quote.create({
      data: { tenantId, customerId: customer.id, flowGroupId: fg.id, quoteNumber: `QPDCO-${suffix}` },
    });
    const wt = await prisma.workflowTemplate.create({
      data: { tenantId, templateKey: `pdco-tk-${suffix}`, displayName: "T" },
    });
    const wv = await prisma.workflowVersion.create({
      data: {
        workflowTemplateId: wt.id,
        versionNumber: 1,
        status: "PUBLISHED",
        publishedAt: new Date(),
        snapshotJson: { nodes: [{ id: "install", type: "TASK" }, { id: "final-inspection", type: "TASK" }] },
      },
    });

    const qv1Id = `qv1-pdco-${suffix}`;
    const pkgV1 = {
      schemaVersion: "executionPackageSnapshot.v0",
      pinnedWorkflowVersionId: wv.id,
      slots: [
        {
          packageTaskId: "PT-A",
          nodeId: "install",
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
        targetNodeKey: "install",
        embeddedPayloadJson: { title: "PDCO line", taskKind: "LABOR" },
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

    const pkgV1Hash = sha256HexUtf8(canonicalStringify(pkgV1));
    await prisma.quoteVersion.update({
      where: { id: qv1.id },
      data: {
        status: "SIGNED",
        executionPackageSnapshot: pkgV1,
        packageSnapshotSha256: pkgV1Hash,
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
        packageSnapshotSha256: pkgV1Hash,
        activatedById: userId,
      },
    });
    const rtA = await prisma.runtimeTask.create({
      data: {
        tenantId,
        flowId: flow1.id,
        packageTaskId: "PT-A",
        nodeId: "install",
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
      reason: "CO draft for portal decline coupling test",
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
          nodeId: "install",
          source: "SOLD_SCOPE",
          planTaskIds: ["PL-A"],
          displayTitle: "Task A",
          lineItemId: "L1",
        },
        {
          packageTaskId: "PT-B",
          nodeId: "final-inspection",
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

    try {
      await prisma.quoteVersion.update({
        where: { id: qv2Id },
        data: {
          executionPackageSnapshot: pkgV2,
          packageSnapshotSha256: sha256HexUtf8(canonicalStringify(pkgV2)),
          generatedPlanSnapshot: planV2,
          planSnapshotSha256: sha256HexUtf8(canonicalStringify(planV2)),
        },
      });

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

      const coPending = await prisma.changeOrder.findUniqueOrThrow({ where: { id: coId } });
      expect(coPending.status).toBe("PENDING_CUSTOMER");

      const declineReason = "  Customer declined: pricing on the add-on work.  ";
      const decline = await declineQuoteVersionViaPortalShareToken(prisma, {
        shareToken: portalToken,
        request: { declineReason },
      });
      expect(decline.ok).toBe(true);
      if (!decline.ok) throw new Error("decline failed");

      const qv2After = await prisma.quoteVersion.findUniqueOrThrow({
        where: { id: qv2Id },
        select: { status: true, portalDeclinedAt: true, portalDeclineReason: true },
      });
      expect(qv2After.status).toBe("DECLINED");
      expect(qv2After.portalDeclineReason).toBe("Customer declined: pricing on the add-on work.");
      expect(qv2After.portalDeclinedAt).toBeTruthy();

      const coVoid = await prisma.changeOrder.findUniqueOrThrow({ where: { id: coId } });
      expect(coVoid.status).toBe("VOID");

      const ws = await getQuoteWorkspaceForTenant(prisma, { tenantId, quoteId: quote.id });
      expect(ws).not.toBeNull();
      const coDto = ws!.changeOrders.find((c) => c.id === coId);
      expect(coDto).toBeDefined();
      expect(coDto!.status).toBe("VOID");
      expect(coDto!.draftQuoteVersionStatus).toBe("DECLINED");
      expect(coDto!.draftQuotePortalDeclineReason).toBe(qv2After.portalDeclineReason);
      expect(coDto!.draftQuotePortalDeclinedAtIso).toBe(qv2After.portalDeclinedAt!.toISOString());
    } finally {
      await prisma.quotePortalShareDelivery.deleteMany({ where: { tenantId } });
      await prisma.paymentGateTarget.deleteMany({ where: { paymentGate: { jobId: job.id } } });
      await prisma.paymentGate.deleteMany({ where: { jobId: job.id } });
      await prisma.taskExecution.deleteMany({ where: { tenantId } });
      await prisma.runtimeTask.deleteMany({ where: { tenantId } });
      await prisma.activation.deleteMany({ where: { jobId: job.id } });
      await prisma.flow.deleteMany({ where: { jobId: job.id } });
      await prisma.changeOrder.deleteMany({ where: { jobId: job.id } });
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
});
