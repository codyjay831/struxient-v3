import { describe, expect, it } from "vitest";
import { getPrisma } from "../../src/server/db/prisma";
import { getQuotePortalPresentationByShareToken } from "../../src/server/slice1/reads/quote-portal-reads";
import { sendQuoteVersionForTenant } from "../../src/server/slice1/mutations/send-quote-version";
import { createNextQuoteVersionForTenant } from "../../src/server/slice1/mutations/create-next-quote-version";
import { voidQuoteVersionForTenant } from "../../src/server/slice1/mutations/void-quote-version-for-tenant";
import {
  createWorkflowTemplateForTenant,
  createWorkflowVersionDraftForTenant,
  publishWorkflowVersionForTenant,
  replaceWorkflowVersionDraftSnapshotForTenant,
  setPinnedWorkflowVersionForTenant,
} from "../../src/server/slice1";
import { createQuoteLineItemForTenant } from "../../src/server/slice1/mutations/quote-line-item-mutations";

describe("Epic 14 quote void + supersede", () => {
  it("supersedes prior SENT on newer send, void blocks portal, void refuses signed", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `e14-${suffix}`;
    const userId = `user-e14-${suffix}`;

    await prisma.tenant.create({ data: { id: tenantId, name: "E14", autoActivateOnSign: false } });
    await prisma.user.create({
      data: { id: userId, tenantId, email: `e14-${suffix}@t.com`, role: "OFFICE_ADMIN" },
    });
    const customer = await prisma.customer.create({ data: { tenantId, name: "Cust" } });
    const fg = await prisma.flowGroup.create({ data: { tenantId, customerId: customer.id, name: "FG" } });
    const quote = await prisma.quote.create({
      data: { tenantId, customerId: customer.id, flowGroupId: fg.id, quoteNumber: `QE14-${suffix}` },
    });
    const qv1 = await prisma.quoteVersion.create({
      data: { quoteId: quote.id, versionNumber: 1, status: "DRAFT", createdById: userId },
    });
    const group = await prisma.proposalGroup.create({
      data: { quoteVersionId: qv1.id, name: "G", sortOrder: 0 },
    });

    let tmplId: string | null = null;

    try {
      const tmpl = await createWorkflowTemplateForTenant(prisma, {
        tenantId,
        templateKey: `e14-tk-${suffix}`,
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
        quoteVersionId: qv1.id,
        pinnedWorkflowVersionId: draft.id,
      });
      if (pin === "not_found") throw new Error("unexpected");

      const localPacket = await prisma.quoteLocalPacket.create({
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
          quoteLocalPacketId: localPacket.id,
          lineKey: "lk1",
          sortOrder: 0,
          lineKind: "EMBEDDED",
          targetNodeKey: "install",
          embeddedPayloadJson: { title: "Task A", taskKind: "LABOR" },
        },
      });
      const line = await createQuoteLineItemForTenant(prisma, {
        tenantId,
        quoteVersionId: qv1.id,
        proposalGroupId: group.id,
        sortOrder: 0,
        quantity: 1,
        executionMode: "MANIFEST",
        title: "M",
        quoteLocalPacketId: localPacket.id,
      });
      if (line === "not_found") throw new Error("unexpected");

      const tok1Row = await prisma.quoteVersion.findUniqueOrThrow({
        where: { id: qv1.id },
        select: { composePreviewStalenessToken: true },
      });
      const send1 = await sendQuoteVersionForTenant(prisma, {
        tenantId,
        quoteVersionId: qv1.id,
        sentByUserId: userId,
        request: { clientStalenessToken: tok1Row.composePreviewStalenessToken ?? null },
      });
      expect(send1.ok).toBe(true);
      if (!send1.ok) throw new Error("send1 failed");
      const token1 = send1.data.portalQuoteShareToken!;

      const next = await createNextQuoteVersionForTenant(prisma, {
        tenantId,
        quoteId: quote.id,
        createdByUserId: userId,
      });
      expect(next.ok).toBe(true);
      if (!next.ok) throw new Error("next failed");
      const qv2Id = next.data.quoteVersionId;

      const tok2Row = await prisma.quoteVersion.findUniqueOrThrow({
        where: { id: qv2Id },
        select: { composePreviewStalenessToken: true },
      });
      const send2 = await sendQuoteVersionForTenant(prisma, {
        tenantId,
        quoteVersionId: qv2Id,
        sentByUserId: userId,
        request: { clientStalenessToken: tok2Row.composePreviewStalenessToken ?? null },
      });
      expect(send2.ok).toBe(true);
      if (!send2.ok) throw new Error("send2 failed");

      const v1After = await prisma.quoteVersion.findUniqueOrThrow({
        where: { id: qv1.id },
        select: { status: true },
      });
      expect(v1After.status).toBe("SUPERSEDED");

      const portalOld = await getQuotePortalPresentationByShareToken(prisma, { shareToken: token1 });
      expect(portalOld).toBeNull();

      const token2 = send2.data.portalQuoteShareToken!;
      const portalNew = await getQuotePortalPresentationByShareToken(prisma, { shareToken: token2 });
      expect(portalNew).not.toBeNull();
      expect(portalNew!.status).toBe("SENT");

      const void2 = await voidQuoteVersionForTenant(prisma, {
        tenantId,
        quoteVersionId: qv2Id,
        voidedByUserId: userId,
        request: { voidReason: "Customer cancelled before sign." },
      });
      expect(void2.ok).toBe(true);

      const portalVoided = await getQuotePortalPresentationByShareToken(prisma, { shareToken: token2 });
      expect(portalVoided).toBeNull();

      const signedOnly = await prisma.quoteVersion.create({
        data: { quoteId: quote.id, versionNumber: 3, status: "SIGNED", createdById: userId },
      });
      await prisma.quoteSignature.create({
        data: {
          tenantId,
          quoteVersionId: signedOnly.id,
          method: "OFFICE_RECORDED",
          recordedById: userId,
        },
      });
      const voidSigned = await voidQuoteVersionForTenant(prisma, {
        tenantId,
        quoteVersionId: signedOnly.id,
        voidedByUserId: userId,
        request: { voidReason: "should fail" },
      });
      expect(voidSigned.ok).toBe(false);
      if (voidSigned.ok) throw new Error("unexpected");
      expect(voidSigned.kind).toBe("not_voidable_signed");
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
