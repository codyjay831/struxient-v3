import { describe, expect, it } from "vitest";
import { getPrisma } from "../../src/server/db/prisma";
import {
  getWorkflowVersionDiscoveryForTenant,
  listPublishedWorkflowVersionsForTenant,
} from "../../src/server/slice1/reads/workflow-version-reads";
import { setPinnedWorkflowVersionForTenant } from "../../src/server/slice1/mutations/set-pinned-workflow-version";

/**
 * Epic 23 foundation: schema allows honest DRAFT (publishedAt null), SUPERSEDED,
 * and pinning/compose guards stay aligned with actually publishable rows.
 */
describe("workflow version lifecycle (DB integration)", () => {
  it("DRAFT with null publishedAt persists; list + pin rules exclude non-publishable rows", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `wf-life-${suffix}`;
    const userId = `user-wf-${suffix}`;

    await prisma.tenant.create({ data: { id: tenantId, name: `WF lifecycle ${suffix}` } });
    await prisma.user.create({
      data: { id: userId, tenantId, email: `wf-${suffix}@test.com`, role: "OFFICE_ADMIN" },
    });
    const customer = await prisma.customer.create({ data: { tenantId, name: "C" } });
    const flowGroup = await prisma.flowGroup.create({
      data: { tenantId, customerId: customer.id, name: "FG" },
    });
    const quote = await prisma.quote.create({
      data: { tenantId, customerId: customer.id, flowGroupId: flowGroup.id, quoteNumber: `Q-${suffix}` },
    });
    const qvDraft = await prisma.quoteVersion.create({
      data: { quoteId: quote.id, versionNumber: 1, status: "DRAFT", createdById: userId },
    });

    const wt = await prisma.workflowTemplate.create({
      data: { tenantId, templateKey: `tk-${suffix}`, displayName: "Template" },
    });

    const wvDraft = await prisma.workflowVersion.create({
      data: {
        workflowTemplateId: wt.id,
        versionNumber: 1,
        status: "DRAFT",
        publishedAt: null,
        snapshotJson: { nodes: [{ id: "install" }] },
      },
    });

    const wvSuperseded = await prisma.workflowVersion.create({
      data: {
        workflowTemplateId: wt.id,
        versionNumber: 2,
        status: "SUPERSEDED",
        publishedAt: new Date("2026-01-01T00:00:00.000Z"),
        snapshotJson: { nodes: [{ id: "install" }] },
      },
    });

    const wvPublished = await prisma.workflowVersion.create({
      data: {
        workflowTemplateId: wt.id,
        versionNumber: 3,
        status: "PUBLISHED",
        publishedAt: new Date(),
        snapshotJson: { nodes: [{ id: "install" }] },
      },
    });

    const row = await prisma.workflowVersion.findUnique({ where: { id: wvDraft.id } });
    expect(row?.status).toBe("DRAFT");
    expect(row?.publishedAt).toBeNull();

    const discoveryDraft = await getWorkflowVersionDiscoveryForTenant(prisma, {
      tenantId,
      workflowVersionId: wvDraft.id,
    });
    expect(discoveryDraft?.publishedAt).toBeNull();
    expect(discoveryDraft?.status).toBe("DRAFT");

    const list = await listPublishedWorkflowVersionsForTenant(prisma, { tenantId, limit: 50 });
    const ids = list.map((x) => x.id);
    expect(ids).toContain(wvPublished.id);
    expect(ids).not.toContain(wvDraft.id);
    expect(ids).not.toContain(wvSuperseded.id);
    expect(list.find((x) => x.id === wvPublished.id)?.publishedAt).toMatch(/^\d{4}-/);

    await expect(
      setPinnedWorkflowVersionForTenant(prisma, {
        tenantId,
        quoteVersionId: qvDraft.id,
        pinnedWorkflowVersionId: wvDraft.id,
      }),
    ).rejects.toMatchObject({ code: "PINNED_WORKFLOW_VERSION_NOT_PUBLISHED" });

    await expect(
      setPinnedWorkflowVersionForTenant(prisma, {
        tenantId,
        quoteVersionId: qvDraft.id,
        pinnedWorkflowVersionId: wvSuperseded.id,
      }),
    ).rejects.toMatchObject({ code: "PINNED_WORKFLOW_VERSION_NOT_PUBLISHED" });

    const pinned = await setPinnedWorkflowVersionForTenant(prisma, {
      tenantId,
      quoteVersionId: qvDraft.id,
      pinnedWorkflowVersionId: wvPublished.id,
    });
    expect(pinned).not.toBe("not_found");
    if (pinned !== "not_found") {
      expect(pinned.pinnedWorkflowVersionId).toBe(wvPublished.id);
    }

    // PUBLISHED but missing publishedAt must not be pin-capable (belt-and-suspenders for data bugs)
    const wvBadPublished = await prisma.workflowVersion.create({
      data: {
        workflowTemplateId: wt.id,
        versionNumber: 4,
        status: "PUBLISHED",
        publishedAt: null,
        snapshotJson: { nodes: [{ id: "install" }] },
      },
    });
    await expect(
      setPinnedWorkflowVersionForTenant(prisma, {
        tenantId,
        quoteVersionId: qvDraft.id,
        pinnedWorkflowVersionId: null,
      }),
    ).resolves.toBeDefined();
    await expect(
      setPinnedWorkflowVersionForTenant(prisma, {
        tenantId,
        quoteVersionId: qvDraft.id,
        pinnedWorkflowVersionId: wvBadPublished.id,
      }),
    ).rejects.toMatchObject({ code: "PINNED_WORKFLOW_VERSION_NOT_PUBLISHED" });

    // Cleanup (respect FKs)
    await prisma.quoteVersion.update({
      where: { id: qvDraft.id },
      data: { pinnedWorkflowVersionId: null },
    });
    await prisma.quoteVersion.deleteMany({ where: { quoteId: quote.id } });
    await prisma.quote.deleteMany({ where: { id: quote.id } });
    await prisma.workflowVersion.deleteMany({ where: { workflowTemplateId: wt.id } });
    await prisma.workflowTemplate.deleteMany({ where: { id: wt.id } });
    await prisma.flowGroup.deleteMany({ where: { id: flowGroup.id } });
    await prisma.customer.deleteMany({ where: { id: customer.id } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
  });
});
