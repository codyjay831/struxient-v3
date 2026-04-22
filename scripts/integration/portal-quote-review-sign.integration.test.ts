import { describe, expect, it } from "vitest";
import { getPrisma } from "../../src/server/db/prisma";
import { getQuotePortalPresentationByShareToken } from "../../src/server/slice1/reads/quote-portal-reads";
import { signQuoteVersionViaPortalShareToken } from "../../src/server/slice1/mutations/sign-quote-version-via-portal";
import { sendQuoteVersionForTenant } from "../../src/server/slice1/mutations/send-quote-version";
import {
  createWorkflowTemplateForTenant,
  createWorkflowVersionDraftForTenant,
  listQuotePortalShareDeliveriesForTenant,
  publishWorkflowVersionForTenant,
  regenerateQuotePortalShareTokenForTenant,
  replaceWorkflowVersionDraftSnapshotForTenant,
  sendQuotePortalShareForTenant,
  setPinnedWorkflowVersionForTenant,
} from "../../src/server/slice1";
import {
  createQuoteLineItemForTenant,
} from "../../src/server/slice1/mutations/quote-line-item-mutations";

describe("Epic 54 portal quote review + customer sign", () => {
  it("issues share token on send, serves frozen plan titles, and records CUSTOMER_PORTAL_ACCEPTED", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `p54-${suffix}`;
    const userId = `user-p54-${suffix}`;

    await prisma.tenant.create({ data: { id: tenantId, name: "P54", autoActivateOnSign: false } });
    await prisma.user.create({
      data: { id: userId, tenantId, email: `p54-${suffix}@t.com`, role: "OFFICE_ADMIN" },
    });
    const customer = await prisma.customer.create({ data: { tenantId, name: "Cust" } });
    const fg = await prisma.flowGroup.create({ data: { tenantId, customerId: customer.id, name: "FG" } });
    const quote = await prisma.quote.create({
      data: { tenantId, customerId: customer.id, flowGroupId: fg.id, quoteNumber: `QP54-${suffix}` },
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
        templateKey: `p54-tk-${suffix}`,
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
        snapshotJson: { nodes: [{ id: "n1", type: "TASK" }] },
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
          targetNodeKey: "n1",
          embeddedPayloadJson: { title: "Portal-visible task", taskKind: "LABOR" },
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
      expect(send.data.portalQuoteShareToken).toBeTruthy();
      const tokenBeforeRegen = send.data.portalQuoteShareToken!;

      const manualDel = await sendQuotePortalShareForTenant(prisma, {
        tenantId,
        quoteVersionId: qv.id,
        actorUserId: userId,
        request: {
          method: "MANUAL_LINK",
          recipientDetail: "manual-handoff",
          baseUrl: "http://127.0.0.1:3000",
        },
      });
      expect(manualDel.ok).toBe(true);

      const emailDel = await sendQuotePortalShareForTenant(prisma, {
        tenantId,
        quoteVersionId: qv.id,
        actorUserId: userId,
        request: {
          method: "EMAIL",
          recipientDetail: `portal-${suffix}@example.com`,
          baseUrl: "http://127.0.0.1:3000",
        },
      });
      expect(emailDel.ok).toBe(true);

      const listed = await listQuotePortalShareDeliveriesForTenant(prisma, {
        tenantId,
        quoteVersionId: qv.id,
      });
      expect(listed.length).toBeGreaterThanOrEqual(2);

      const regen = await regenerateQuotePortalShareTokenForTenant(prisma, {
        tenantId,
        quoteVersionId: qv.id,
        actorUserId: userId,
      });
      expect(regen.ok).toBe(true);
      if (!regen.ok) throw new Error("regen failed");
      expect(regen.data.portalQuoteShareToken).not.toBe(tokenBeforeRegen);

      const stalePortal = await getQuotePortalPresentationByShareToken(prisma, {
        shareToken: tokenBeforeRegen,
      });
      expect(stalePortal).toBeNull();

      const portal = await getQuotePortalPresentationByShareToken(prisma, {
        shareToken: regen.data.portalQuoteShareToken,
      });
      expect(portal).not.toBeNull();
      expect(portal!.status).toBe("SENT");
      expect(portal!.planRows.some((r) => r.title.includes("Portal-visible"))).toBe(true);

      const sign = await signQuoteVersionViaPortalShareToken(prisma, {
        shareToken: regen.data.portalQuoteShareToken,
        request: {
          signerName: "Alex Customer",
          signerEmail: "alex@example.com",
          acceptTerms: true,
        },
      });
      expect(sign.ok).toBe(true);
      if (!sign.ok) throw new Error("sign failed");

      const sig = await prisma.quoteSignature.findUniqueOrThrow({
        where: { quoteVersionId: qv.id },
      });
      expect(sig.method).toBe("CUSTOMER_PORTAL_ACCEPTED");
      expect(sig.recordedById).toBeNull();
      expect(sig.portalSignerLabel).toContain("Alex Customer");
      expect(sig.portalSignerLabel).toContain("alex@example.com");

      const portalAfter = await getQuotePortalPresentationByShareToken(prisma, {
        shareToken: regen.data.portalQuoteShareToken,
      });
      expect(portalAfter!.status).toBe("SIGNED");
    } finally {
      await prisma.quotePortalShareDelivery.deleteMany({ where: { tenantId } });
      await prisma.quoteSignature.deleteMany({ where: { tenantId } });
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
