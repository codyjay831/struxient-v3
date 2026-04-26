import { describe, expect, it } from "vitest";
import { getPrisma } from "../../src/server/db/prisma";
import { getQuotePortalPresentationByShareToken } from "../../src/server/slice1/reads/quote-portal-reads";
import { getQuoteVersionHistoryForTenant } from "../../src/server/slice1/reads/quote-version-history-reads";
import { requestQuoteChangesViaPortalShareToken } from "../../src/server/slice1/mutations/request-quote-changes-via-portal";
import { sendQuoteVersionForTenant } from "../../src/server/slice1/mutations/send-quote-version";
import {
  createWorkflowTemplateForTenant,
  createWorkflowVersionDraftForTenant,
  publishWorkflowVersionForTenant,
  replaceWorkflowVersionDraftSnapshotForTenant,
  setPinnedWorkflowVersionForTenant,
} from "../../src/server/slice1";
import { createQuoteLineItemForTenant } from "../../src/server/slice1/mutations/quote-line-item-mutations";

describe("Epic 13 + 54 portal quote request changes (non-terminal)", () => {
  it("persists message + timestamp, audit event, SENT unchanged, portal + history read models", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `prc-${suffix}`;
    const userId = `user-prc-${suffix}`;

    await prisma.tenant.create({ data: { id: tenantId, name: "PRC", autoActivateOnSign: false } });
    await prisma.user.create({
      data: { id: userId, tenantId, email: `prc-${suffix}@t.com`, role: "OFFICE_ADMIN" },
    });
    const customer = await prisma.customer.create({ data: { tenantId, name: "Cust" } });
    const fg = await prisma.flowGroup.create({ data: { tenantId, customerId: customer.id, name: "FG" } });
    const quote = await prisma.quote.create({
      data: { tenantId, customerId: customer.id, flowGroupId: fg.id, quoteNumber: `QPRC-${suffix}` },
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
        templateKey: `prc-tk-${suffix}`,
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
          embeddedPayloadJson: { title: "RC-visible task", taskKind: "LABOR" },
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
      expect(portalBefore?.portalChangeRequestedAtIso).toBeNull();

      const req = await requestQuoteChangesViaPortalShareToken(prisma, {
        shareToken: token,
        request: { message: "  Please adjust flashing details.  " },
      });
      expect(req.ok).toBe(true);
      if (!req.ok) throw new Error("request failed");
      expect(req.data.status).toBe("SENT");
      expect(req.data.idempotentReplay).toBe(false);

      const row = await prisma.quoteVersion.findUniqueOrThrow({
        where: { id: qv.id },
        select: {
          status: true,
          portalChangeRequestedAt: true,
          portalChangeRequestMessage: true,
        },
      });
      expect(row.status).toBe("SENT");
      expect(row.portalChangeRequestMessage).toBe("Please adjust flashing details.");
      expect(row.portalChangeRequestedAt).toBeTruthy();

      const audit = await prisma.auditEvent.findFirst({
        where: { tenantId, eventType: "QUOTE_VERSION_CHANGE_REQUESTED_PORTAL", targetQuoteVersionId: qv.id },
      });
      expect(audit).toBeTruthy();

      const portalAfter = await getQuotePortalPresentationByShareToken(prisma, { shareToken: token });
      expect(portalAfter?.status).toBe("SENT");
      expect(portalAfter?.portalChangeRequestMessage).toBe(row.portalChangeRequestMessage);
      expect(portalAfter?.portalChangeRequestedAtIso).toBe(row.portalChangeRequestedAt!.toISOString());

      const hist = await getQuoteVersionHistoryForTenant(prisma, { tenantId, quoteId: quote.id });
      expect(hist).not.toBeNull();
      const hv = hist!.versions.find((v) => v.id === qv.id);
      expect(hv?.portalChangeRequestMessage).toBe(row.portalChangeRequestMessage);
      expect(hv?.portalChangeRequestedAt).toBe(row.portalChangeRequestedAt!.toISOString());

      const again = await requestQuoteChangesViaPortalShareToken(prisma, {
        shareToken: token,
        request: { message: "Please adjust flashing details." },
      });
      expect(again.ok).toBe(true);
      if (!again.ok) throw new Error("replay failed");
      expect(again.data.idempotentReplay).toBe(true);

      const update = await requestQuoteChangesViaPortalShareToken(prisma, {
        shareToken: token,
        request: { message: "Also need revised start date." },
      });
      expect(update.ok).toBe(true);
      if (!update.ok) throw new Error("update failed");
      expect(update.data.idempotentReplay).toBe(false);
      const row2 = await prisma.quoteVersion.findUniqueOrThrow({
        where: { id: qv.id },
        select: { portalChangeRequestMessage: true },
      });
      expect(row2.portalChangeRequestMessage).toBe("Also need revised start date.");

      const audits = await prisma.auditEvent.count({
        where: { tenantId, eventType: "QUOTE_VERSION_CHANGE_REQUESTED_PORTAL", targetQuoteVersionId: qv.id },
      });
      expect(audits).toBe(2);
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
});
