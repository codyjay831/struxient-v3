import { describe, expect, it } from "vitest";
import { getPrisma } from "../../src/server/db/prisma";
import {
  buildComposePreviewResponse,
  createWorkflowTemplateForTenant,
  createWorkflowVersionDraftForTenant,
  publishWorkflowVersionForTenant,
  replaceWorkflowVersionDraftSnapshotForTenant,
  setPinnedWorkflowVersionForTenant,
} from "../../src/server/slice1";

/**
 * Epic 23 hardening: authored workflow (template → draft → snapshot → publish) is pinned on a draft
 * quote version, then scope binds via `targetNodeKey` during compose-preview:
 * - quote-local packet items (`QuoteLocalPacketItem`)
 * - library catalog lines (`PacketTaskLine` on a PUBLISHED `ScopePacketRevision`)
 * No `prisma.workflowVersion.create` for the workflow under test.
 */
describe("authored workflow + quote-local packet compose", () => {
  it("publishes, pins, binds valid node ids, then rejects unknown node ids with PACKAGE_BIND_FAILED", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `awf-compose-${suffix}`;
    const userId = `user-awf-compose-${suffix}`;

    await prisma.tenant.create({ data: { id: tenantId, name: `AWF compose ${suffix}` } });
    await prisma.user.create({
      data: { id: userId, tenantId, email: `awf-compose-${suffix}@test.com`, role: "OFFICE_ADMIN" },
    });
    const customer = await prisma.customer.create({ data: { tenantId, name: "C" } });
    const flowGroup = await prisma.flowGroup.create({
      data: { tenantId, customerId: customer.id, name: "FG" },
    });
    const quote = await prisma.quote.create({
      data: { tenantId, customerId: customer.id, flowGroupId: flowGroup.id, quoteNumber: `Q-${suffix}` },
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
        templateKey: `awf-tk-${suffix}`,
        displayName: "Compose Template",
      });
      tmplId = tmpl.id;

      const draft = await createWorkflowVersionDraftForTenant(prisma, {
        tenantId,
        workflowTemplateId: tmpl.id,
      });
      if (draft === "not_found") throw new Error("unexpected not_found");

      await replaceWorkflowVersionDraftSnapshotForTenant(prisma, {
        tenantId,
        workflowVersionId: draft.id,
        snapshotJson: { nodes: [{ id: "alpha" }, { id: "beta" }] },
      });

      const published = await publishWorkflowVersionForTenant(prisma, {
        tenantId,
        workflowVersionId: draft.id,
        userId,
      });
      if (published === "not_found") throw new Error("unexpected not_found");
      const publishedWorkflowVersionId = draft.id;

      const pin = await setPinnedWorkflowVersionForTenant(prisma, {
        tenantId,
        quoteVersionId: qv.id,
        pinnedWorkflowVersionId: publishedWorkflowVersionId,
      });
      if (pin === "not_found") throw new Error("unexpected not_found");
      expect(pin.pinnedWorkflowVersionId).toBe(publishedWorkflowVersionId);

      const localPacket = await prisma.quoteLocalPacket.create({
        data: {
          tenantId,
          quoteVersionId: qv.id,
          displayName: "Local packet",
          originType: "MANUAL_LOCAL",
          createdById: userId,
        },
      });

      await prisma.quoteLocalPacketItem.create({
        data: {
          quoteLocalPacketId: localPacket.id,
          lineKey: "line-alpha",
          sortOrder: 0,
          lineKind: "EMBEDDED",
          targetNodeKey: "alpha",
          embeddedPayloadJson: { title: "Alpha task", taskKind: "LABOR" },
        },
      });

      const manifestLine = await prisma.quoteLineItem.create({
        data: {
          quoteVersionId: qv.id,
          proposalGroupId: group.id,
          sortOrder: 0,
          quantity: 1,
          executionMode: "MANIFEST",
          title: "Manifest",
          quoteLocalPacketId: localPacket.id,
        },
      });

      const previewOk = await buildComposePreviewResponse(prisma, {
        tenantId,
        quoteVersionId: qv.id,
        request: {},
      });
      expect(previewOk.ok).toBe(true);
      if (!previewOk.ok) throw new Error("expected compose preview ok");
      expect(previewOk.data.errors).toHaveLength(0);

      const row = previewOk.data.planPreview.rows[0];
      expect(row).toBeDefined();
      expect(row?.scopeSource).toBe("QUOTE_LOCAL_PACKET");
      expect(row?.targetNodeKey).toBe("alpha");
      expect(row?.localLineKey).toBe("line-alpha");
      expect(row?.quoteLocalPacketId).toBe(localPacket.id);
      expect(row?.lineItemId).toBe(manifestLine.id);

      const slot = previewOk.data.packagePreview.slots.find((s) => s.nodeId === "alpha");
      expect(slot).toBeDefined();
      expect(slot?.planTaskIds).toEqual([row!.planTaskId]);

      await prisma.quoteLocalPacketItem.create({
        data: {
          quoteLocalPacketId: localPacket.id,
          lineKey: "line-ghost",
          sortOrder: 1,
          lineKind: "EMBEDDED",
          targetNodeKey: "ghost-node-not-on-snapshot",
          embeddedPayloadJson: { title: "Ghost", taskKind: "LABOR" },
        },
      });

      const previewBad = await buildComposePreviewResponse(prisma, {
        tenantId,
        quoteVersionId: qv.id,
        request: {},
      });
      expect(previewBad.ok).toBe(true);
      if (!previewBad.ok) throw new Error("expected compose preview ok");
      const bindErr = previewBad.data.errors.find((e) => e.code === "PACKAGE_BIND_FAILED");
      expect(bindErr).toBeDefined();
      expect(bindErr?.message).toContain("ghost-node-not-on-snapshot");
      expect(bindErr?.lineItemId).toBe(manifestLine.id);
      expect(bindErr?.details).toMatchObject({
        localLineKey: "line-ghost",
        targetNodeKey: "ghost-node-not-on-snapshot",
      });

      const stillBound = previewBad.data.planPreview.rows.filter((r) => r.targetNodeKey === "alpha");
      expect(stillBound).toHaveLength(1);
    } finally {
      await prisma.quoteVersion.deleteMany({ where: { quoteId: quote.id } });
      await prisma.quote.deleteMany({ where: { id: quote.id } });
      if (tmplId) {
        await prisma.workflowVersion.deleteMany({ where: { workflowTemplateId: tmplId } });
        await prisma.workflowTemplate.deleteMany({ where: { id: tmplId } });
      }
      await prisma.flowGroup.deleteMany({ where: { id: flowGroup.id } });
      await prisma.customer.deleteMany({ where: { id: customer.id } });
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }
  });
});

/**
 * Library path mirror: `PacketTaskLine.targetNodeKey` (and embedded fallback) binds to the same
 * pinned authored workflow snapshot as quote-local items (`compose-engine.ts` catalog branch).
 */
describe("authored workflow + library packet compose", () => {
  it("publishes, pins, binds catalog task lines to workflow nodes, then rejects unknown node ids", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `awf-lib-${suffix}`;
    const userId = `user-awf-lib-${suffix}`;

    await prisma.tenant.create({ data: { id: tenantId, name: `AWF lib ${suffix}` } });
    await prisma.user.create({
      data: { id: userId, tenantId, email: `awf-lib-${suffix}@test.com`, role: "OFFICE_ADMIN" },
    });
    const customer = await prisma.customer.create({ data: { tenantId, name: "C" } });
    const flowGroup = await prisma.flowGroup.create({
      data: { tenantId, customerId: customer.id, name: "FG" },
    });
    const quote = await prisma.quote.create({
      data: { tenantId, customerId: customer.id, flowGroupId: flowGroup.id, quoteNumber: `Q-LIB-${suffix}` },
    });
    const qv = await prisma.quoteVersion.create({
      data: { quoteId: quote.id, versionNumber: 1, status: "DRAFT", createdById: userId },
    });
    const group = await prisma.proposalGroup.create({
      data: { quoteVersionId: qv.id, name: "G", sortOrder: 0 },
    });

    let tmplId: string | null = null;
    let scopePacketId: string | null = null;
    let scopePacketRevisionId: string | null = null;
    try {
      const scopePacket = await prisma.scopePacket.create({
        data: {
          tenantId,
          packetKey: `lib-packet-${suffix}`,
          displayName: "Library packet",
        },
      });
      scopePacketId = scopePacket.id;

      const revision = await prisma.scopePacketRevision.create({
        data: {
          scopePacketId: scopePacket.id,
          revisionNumber: 1,
          status: "PUBLISHED",
          publishedAt: new Date(),
        },
      });
      scopePacketRevisionId = revision.id;

      await prisma.packetTaskLine.create({
        data: {
          scopePacketRevisionId: revision.id,
          lineKey: "cat-alpha",
          sortOrder: 0,
          lineKind: "EMBEDDED",
          targetNodeKey: "alpha",
          embeddedPayloadJson: { title: "Catalog alpha", taskKind: "LABOR" },
        },
      });

      const tmpl = await createWorkflowTemplateForTenant(prisma, {
        tenantId,
        templateKey: `awf-lib-tk-${suffix}`,
        displayName: "Lib compose template",
      });
      tmplId = tmpl.id;

      const draft = await createWorkflowVersionDraftForTenant(prisma, {
        tenantId,
        workflowTemplateId: tmpl.id,
      });
      if (draft === "not_found") throw new Error("unexpected not_found");

      await replaceWorkflowVersionDraftSnapshotForTenant(prisma, {
        tenantId,
        workflowVersionId: draft.id,
        snapshotJson: { nodes: [{ id: "alpha" }, { id: "beta" }] },
      });

      const published = await publishWorkflowVersionForTenant(prisma, {
        tenantId,
        workflowVersionId: draft.id,
        userId,
      });
      if (published === "not_found") throw new Error("unexpected not_found");

      const pin = await setPinnedWorkflowVersionForTenant(prisma, {
        tenantId,
        quoteVersionId: qv.id,
        pinnedWorkflowVersionId: draft.id,
      });
      if (pin === "not_found") throw new Error("unexpected not_found");

      const manifestLine = await prisma.quoteLineItem.create({
        data: {
          quoteVersionId: qv.id,
          proposalGroupId: group.id,
          sortOrder: 0,
          quantity: 1,
          executionMode: "MANIFEST",
          title: "Manifest library",
          scopePacketRevisionId: revision.id,
        },
      });

      const previewOk = await buildComposePreviewResponse(prisma, {
        tenantId,
        quoteVersionId: qv.id,
        request: {},
      });
      expect(previewOk.ok).toBe(true);
      if (!previewOk.ok) throw new Error("expected compose preview ok");
      expect(previewOk.data.errors).toHaveLength(0);

      const row = previewOk.data.planPreview.rows[0];
      expect(row).toBeDefined();
      expect(row?.scopeSource).toBe("LIBRARY_PACKET");
      expect(row?.targetNodeKey).toBe("alpha");
      expect(row?.packetLineKey).toBe("cat-alpha");
      expect(row?.scopePacketRevisionId).toBe(revision.id);
      expect(row?.lineItemId).toBe(manifestLine.id);

      const slot = previewOk.data.packagePreview.slots.find((s) => s.nodeId === "alpha");
      expect(slot).toBeDefined();
      expect(slot?.planTaskIds).toEqual([row!.planTaskId]);

      await prisma.packetTaskLine.create({
        data: {
          scopePacketRevisionId: revision.id,
          lineKey: "cat-ghost",
          sortOrder: 1,
          lineKind: "EMBEDDED",
          targetNodeKey: "ghost-lib-node",
          embeddedPayloadJson: { title: "Ghost catalog", taskKind: "LABOR" },
        },
      });

      const previewBad = await buildComposePreviewResponse(prisma, {
        tenantId,
        quoteVersionId: qv.id,
        request: {},
      });
      expect(previewBad.ok).toBe(true);
      if (!previewBad.ok) throw new Error("expected compose preview ok");
      const bindErr = previewBad.data.errors.find((e) => e.code === "PACKAGE_BIND_FAILED");
      expect(bindErr).toBeDefined();
      expect(bindErr?.message).toContain("ghost-lib-node");
      expect(bindErr?.lineItemId).toBe(manifestLine.id);
      expect(bindErr?.details).toMatchObject({
        packetLineKey: "cat-ghost",
        targetNodeKey: "ghost-lib-node",
      });

      const stillBound = previewBad.data.planPreview.rows.filter((r) => r.targetNodeKey === "alpha");
      expect(stillBound).toHaveLength(1);
    } finally {
      await prisma.quoteVersion.deleteMany({ where: { quoteId: quote.id } });
      await prisma.quote.deleteMany({ where: { id: quote.id } });
      if (tmplId) {
        await prisma.workflowVersion.deleteMany({ where: { workflowTemplateId: tmplId } });
        await prisma.workflowTemplate.deleteMany({ where: { id: tmplId } });
      }
      if (scopePacketRevisionId) {
        await prisma.packetTaskLine.deleteMany({ where: { scopePacketRevisionId } });
        await prisma.scopePacketRevision.deleteMany({ where: { id: scopePacketRevisionId } });
      }
      if (scopePacketId) {
        await prisma.scopePacket.deleteMany({ where: { id: scopePacketId } });
      }
      await prisma.flowGroup.deleteMany({ where: { id: flowGroup.id } });
      await prisma.customer.deleteMany({ where: { id: customer.id } });
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }
  });
});
