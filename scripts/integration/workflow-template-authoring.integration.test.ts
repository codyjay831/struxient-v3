import { describe, expect, it } from "vitest";
import { getPrisma } from "../../src/server/db/prisma";
import {
  createWorkflowTemplateForTenant,
  createWorkflowVersionDraftForTenant,
  forkWorkflowVersionDraftFromSourceForTenant,
  getWorkflowTemplateDetailForTenant,
  listPublishedWorkflowVersionsForTenant,
  publishWorkflowVersionForTenant,
  replaceWorkflowVersionDraftSnapshotForTenant,
  setPinnedWorkflowVersionForTenant,
} from "../../src/server/slice1";
import { workflowVersionAllowsSnapshotJsonEdit } from "../../src/lib/process-templates-office";

/**
 * Epic 23 — first real authoring path (template → draft → snapshot → publish → supersede).
 * Does **not** use `prisma.workflowVersion.create` for the workflow under test.
 */
describe("workflow template authoring (mutations)", () => {
  it("end-to-end: template, draft, snapshot, publish, second publish supersedes, list + pin rules", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `wf-auth-${suffix}`;
    const userId = `user-wf-auth-${suffix}`;

    await prisma.tenant.create({ data: { id: tenantId, name: `WF auth ${suffix}` } });
    await prisma.user.create({
      data: { id: userId, tenantId, email: `wf-auth-${suffix}@test.com`, role: "OFFICE_ADMIN" },
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

    const tmpl = await createWorkflowTemplateForTenant(prisma, {
      tenantId,
      templateKey: `tk-${suffix}`,
      displayName: "Authored Template",
    });

    await expect(
      createWorkflowTemplateForTenant(prisma, {
        tenantId,
        templateKey: `tk-${suffix}`,
        displayName: "Dup",
      }),
    ).rejects.toMatchObject({ code: "WORKFLOW_TEMPLATE_KEY_TAKEN" });

    const draft1 = await createWorkflowVersionDraftForTenant(prisma, {
      tenantId,
      workflowTemplateId: tmpl.id,
    });
    if (draft1 === "not_found") throw new Error("unexpected not_found");
    expect(draft1.status).toBe("DRAFT");
    expect(draft1.publishedAt).toBeNull();

    await expect(
      createWorkflowVersionDraftForTenant(prisma, {
        tenantId,
        workflowTemplateId: tmpl.id,
      }),
    ).rejects.toMatchObject({ code: "WORKFLOW_TEMPLATE_DRAFT_VERSION_EXISTS" });

    await expect(
      replaceWorkflowVersionDraftSnapshotForTenant(prisma, {
        tenantId,
        workflowVersionId: draft1.id,
        snapshotJson: { nodes: [{ id: "dup" }, { id: "dup" }] },
      }),
    ).rejects.toMatchObject({ code: "WORKFLOW_VERSION_SNAPSHOT_INVALID" });

    await expect(
      publishWorkflowVersionForTenant(prisma, {
        tenantId,
        workflowVersionId: draft1.id,
        userId,
      }),
    ).rejects.toMatchObject({ code: "WORKFLOW_VERSION_SNAPSHOT_INVALID" });

    const replaced = await replaceWorkflowVersionDraftSnapshotForTenant(prisma, {
      tenantId,
      workflowVersionId: draft1.id,
      snapshotJson: { nodes: [{ id: "install" }, { id: "final-inspection" }] },
    });
    if (replaced === "not_found") throw new Error("unexpected not_found");
    expect(replaced.snapshotJson).toEqual({ nodes: [{ id: "install" }, { id: "final-inspection" }] });

    const pub1 = await publishWorkflowVersionForTenant(prisma, {
      tenantId,
      workflowVersionId: draft1.id,
      userId,
    });
    if (pub1 === "not_found") throw new Error("unexpected not_found");
    expect(pub1.status).toBe("PUBLISHED");
    expect(pub1.demotedSiblingCount).toBe(0);
    expect(pub1.publishedAtIso).toMatch(/^\d{4}-/);

    const rowV1 = await prisma.workflowVersion.findUnique({ where: { id: draft1.id } });
    expect(rowV1?.status).toBe("PUBLISHED");
    expect(rowV1?.publishedAt).not.toBeNull();

    const draft2 = await createWorkflowVersionDraftForTenant(prisma, {
      tenantId,
      workflowTemplateId: tmpl.id,
    });
    if (draft2 === "not_found") throw new Error("unexpected not_found");
    expect(draft2.versionNumber).toBe(2);

    await replaceWorkflowVersionDraftSnapshotForTenant(prisma, {
      tenantId,
      workflowVersionId: draft2.id,
      snapshotJson: { nodes: [{ id: "x1" }] },
    });

    const pub2 = await publishWorkflowVersionForTenant(prisma, {
      tenantId,
      workflowVersionId: draft2.id,
      userId,
    });
    if (pub2 === "not_found") throw new Error("unexpected not_found");
    expect(pub2.demotedSiblingCount).toBe(1);

    const rowV1After = await prisma.workflowVersion.findUnique({ where: { id: draft1.id } });
    expect(rowV1After?.status).toBe("SUPERSEDED");
    expect(rowV1After?.publishedAt).not.toBeNull();

    const list = await listPublishedWorkflowVersionsForTenant(prisma, { tenantId, limit: 50 });
    const publishedIds = list.filter((i) => i.workflowTemplateId === tmpl.id).map((i) => i.id);
    expect(publishedIds).toContain(draft2.id);
    expect(publishedIds).not.toContain(draft1.id);

    const detail = await getWorkflowTemplateDetailForTenant(prisma, {
      tenantId,
      workflowTemplateId: tmpl.id,
    });
    expect(detail?.versions.map((v) => ({ n: v.versionNumber, status: v.status }))).toEqual([
      { n: 2, status: "PUBLISHED" },
      { n: 1, status: "SUPERSEDED" },
    ]);
    const vPublished = detail?.versions.find((v) => v.id === draft2.id);
    const vSuper = detail?.versions.find((v) => v.id === draft1.id);
    expect(workflowVersionAllowsSnapshotJsonEdit(vPublished!.status)).toBe(false);
    expect(workflowVersionAllowsSnapshotJsonEdit(vSuper!.status)).toBe(false);

    await expect(
      setPinnedWorkflowVersionForTenant(prisma, {
        tenantId,
        quoteVersionId: qv.id,
        pinnedWorkflowVersionId: draft1.id,
      }),
    ).rejects.toMatchObject({ code: "PINNED_WORKFLOW_VERSION_NOT_PUBLISHED" });

    const pinOk = await setPinnedWorkflowVersionForTenant(prisma, {
      tenantId,
      quoteVersionId: qv.id,
      pinnedWorkflowVersionId: draft2.id,
    });
    expect(pinOk).not.toBe("not_found");
    if (pinOk !== "not_found") {
      expect(pinOk.pinnedWorkflowVersionId).toBe(draft2.id);
    }

    await expect(
      replaceWorkflowVersionDraftSnapshotForTenant(prisma, {
        tenantId,
        workflowVersionId: draft1.id,
        snapshotJson: { nodes: [{ id: "nope" }] },
      }),
    ).rejects.toMatchObject({ code: "WORKFLOW_VERSION_SNAPSHOT_REPLACE_NOT_DRAFT" });

    await prisma.quoteVersion.update({
      where: { id: qv.id },
      data: { pinnedWorkflowVersionId: null },
    });
    await prisma.quoteVersion.deleteMany({ where: { quoteId: quote.id } });
    await prisma.quote.deleteMany({ where: { id: quote.id } });
    await prisma.workflowVersion.deleteMany({ where: { workflowTemplateId: tmpl.id } });
    await prisma.workflowTemplate.deleteMany({ where: { id: tmpl.id } });
    await prisma.flowGroup.deleteMany({ where: { id: flowGroup.id } });
    await prisma.customer.deleteMany({ where: { id: customer.id } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
  });

  it("publish rejects re-publish of same version (no longer DRAFT)", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `wf-pub-${suffix}`;
    const userId = `user-pub-${suffix}`;
    await prisma.tenant.create({ data: { id: tenantId, name: "t" } });
    await prisma.user.create({
      data: { id: userId, tenantId, email: `p-${suffix}@t.com`, role: "OFFICE_ADMIN" },
    });

    const tmpl = await createWorkflowTemplateForTenant(prisma, {
      tenantId,
      templateKey: `k-${suffix}`,
      displayName: "T",
    });
    const draft = await createWorkflowVersionDraftForTenant(prisma, {
      tenantId,
      workflowTemplateId: tmpl.id,
    });
    if (draft === "not_found") throw new Error("unexpected not_found");
    await replaceWorkflowVersionDraftSnapshotForTenant(prisma, {
      tenantId,
      workflowVersionId: draft.id,
      snapshotJson: { nodes: [{ id: "n" }] },
    });
    const first = await publishWorkflowVersionForTenant(prisma, {
      tenantId,
      workflowVersionId: draft.id,
      userId,
    });
    if (first === "not_found") throw new Error("unexpected not_found");

    await expect(
      publishWorkflowVersionForTenant(prisma, { tenantId, workflowVersionId: draft.id, userId }),
    ).rejects.toMatchObject({ code: "WORKFLOW_VERSION_PUBLISH_NOT_DRAFT" });

    await prisma.workflowVersion.deleteMany({ where: { workflowTemplateId: tmpl.id } });
    await prisma.workflowTemplate.deleteMany({ where: { id: tmpl.id } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
  });
});

/** Epic 23 — fork published (or superseded) lineage into a new draft with copied snapshot. */
describe("workflow version fork draft from source", () => {
  it("forks PUBLISHED snapshot into new DRAFT, next version number, source unchanged", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `wf-fork-${suffix}`;
    const userId = `user-wf-fork-${suffix}`;
    await prisma.tenant.create({ data: { id: tenantId, name: "t" } });
    await prisma.user.create({
      data: { id: userId, tenantId, email: `fork-${suffix}@t.com`, role: "OFFICE_ADMIN" },
    });
    const snap = { nodes: [{ id: "n-fork", meta: { x: 1 } }] };
    try {
      const tmpl = await createWorkflowTemplateForTenant(prisma, {
        tenantId,
        templateKey: `fk-${suffix}`,
        displayName: "Fork T",
      });
      const d1 = await createWorkflowVersionDraftForTenant(prisma, {
        tenantId,
        workflowTemplateId: tmpl.id,
      });
      if (d1 === "not_found") throw new Error("unexpected not_found");
      await replaceWorkflowVersionDraftSnapshotForTenant(prisma, {
        tenantId,
        workflowVersionId: d1.id,
        snapshotJson: snap,
      });
      await publishWorkflowVersionForTenant(prisma, {
        tenantId,
        workflowVersionId: d1.id,
        userId,
      });

      const forked = await forkWorkflowVersionDraftFromSourceForTenant(prisma, {
        tenantId,
        workflowTemplateId: tmpl.id,
        sourceWorkflowVersionId: d1.id,
      });
      if (forked === "not_found") throw new Error("unexpected not_found");
      expect(forked.versionNumber).toBe(2);
      expect(forked.status).toBe("DRAFT");
      expect(forked.publishedAt).toBeNull();
      expect(forked.snapshotJson).toEqual(snap);
      expect(forked.snapshotJson).not.toBe(snap);
      expect(forked.forkedFromWorkflowVersionId).toBe(d1.id);

      const forkRow = await prisma.workflowVersion.findUnique({
        where: { id: forked.id },
        select: { forkedFromWorkflowVersionId: true },
      });
      expect(forkRow?.forkedFromWorkflowVersionId).toBe(d1.id);

      const src = await prisma.workflowVersion.findUnique({ where: { id: d1.id } });
      expect(src?.status).toBe("PUBLISHED");
      expect(src?.snapshotJson).toEqual(snap);
    } finally {
      await prisma.workflowVersion.deleteMany({ where: { workflowTemplate: { tenantId } } });
      await prisma.workflowTemplate.deleteMany({ where: { tenantId } });
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }
  });

  it("rejects fork when a draft already exists", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `wf-fork2-${suffix}`;
    const userId = `user-wf-fork2-${suffix}`;
    await prisma.tenant.create({ data: { id: tenantId, name: "t" } });
    await prisma.user.create({
      data: { id: userId, tenantId, email: `fork2-${suffix}@t.com`, role: "OFFICE_ADMIN" },
    });
    try {
      const tmpl = await createWorkflowTemplateForTenant(prisma, {
        tenantId,
        templateKey: `fk2-${suffix}`,
        displayName: "T",
      });
      const d1 = await createWorkflowVersionDraftForTenant(prisma, {
        tenantId,
        workflowTemplateId: tmpl.id,
      });
      if (d1 === "not_found") throw new Error("unexpected not_found");
      await replaceWorkflowVersionDraftSnapshotForTenant(prisma, {
        tenantId,
        workflowVersionId: d1.id,
        snapshotJson: { nodes: [{ id: "a" }] },
      });
      await publishWorkflowVersionForTenant(prisma, { tenantId, workflowVersionId: d1.id, userId });
      await forkWorkflowVersionDraftFromSourceForTenant(prisma, {
        tenantId,
        workflowTemplateId: tmpl.id,
        sourceWorkflowVersionId: d1.id,
      });
      await expect(
        forkWorkflowVersionDraftFromSourceForTenant(prisma, {
          tenantId,
          workflowTemplateId: tmpl.id,
          sourceWorkflowVersionId: d1.id,
        }),
      ).rejects.toMatchObject({ code: "WORKFLOW_TEMPLATE_DRAFT_VERSION_EXISTS" });
    } finally {
      await prisma.workflowVersion.deleteMany({ where: { workflowTemplate: { tenantId } } });
      await prisma.workflowTemplate.deleteMany({ where: { tenantId } });
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }
  });

  it("rejects fork from DRAFT source", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `wf-fork3-${suffix}`;
    const userId = `user-wf-fork3-${suffix}`;
    await prisma.tenant.create({ data: { id: tenantId, name: "t" } });
    await prisma.user.create({
      data: { id: userId, tenantId, email: `fork3-${suffix}@t.com`, role: "OFFICE_ADMIN" },
    });
    try {
      const tmpl = await createWorkflowTemplateForTenant(prisma, {
        tenantId,
        templateKey: `fk3-${suffix}`,
        displayName: "T",
      });
      const draft = await createWorkflowVersionDraftForTenant(prisma, {
        tenantId,
        workflowTemplateId: tmpl.id,
      });
      if (draft === "not_found") throw new Error("unexpected not_found");
      await expect(
        forkWorkflowVersionDraftFromSourceForTenant(prisma, {
          tenantId,
          workflowTemplateId: tmpl.id,
          sourceWorkflowVersionId: draft.id,
        }),
      ).rejects.toMatchObject({ code: "WORKFLOW_VERSION_FORK_SOURCE_INVALID" });
    } finally {
      await prisma.workflowVersion.deleteMany({ where: { workflowTemplate: { tenantId } } });
      await prisma.workflowTemplate.deleteMany({ where: { tenantId } });
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }
  });

  it("allows fork from SUPERSEDED source (copies that revision snapshot)", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `wf-fork4-${suffix}`;
    const userId = `user-wf-fork4-${suffix}`;
    await prisma.tenant.create({ data: { id: tenantId, name: "t" } });
    await prisma.user.create({
      data: { id: userId, tenantId, email: `fork4-${suffix}@t.com`, role: "OFFICE_ADMIN" },
    });
    const snapV1 = { nodes: [{ id: "v1-only" }] };
    try {
      const tmpl = await createWorkflowTemplateForTenant(prisma, {
        tenantId,
        templateKey: `fk4-${suffix}`,
        displayName: "T",
      });
      const d1 = await createWorkflowVersionDraftForTenant(prisma, {
        tenantId,
        workflowTemplateId: tmpl.id,
      });
      if (d1 === "not_found") throw new Error("unexpected not_found");
      await replaceWorkflowVersionDraftSnapshotForTenant(prisma, {
        tenantId,
        workflowVersionId: d1.id,
        snapshotJson: snapV1,
      });
      await publishWorkflowVersionForTenant(prisma, { tenantId, workflowVersionId: d1.id, userId });

      const d2 = await createWorkflowVersionDraftForTenant(prisma, {
        tenantId,
        workflowTemplateId: tmpl.id,
      });
      if (d2 === "not_found") throw new Error("unexpected not_found");
      await replaceWorkflowVersionDraftSnapshotForTenant(prisma, {
        tenantId,
        workflowVersionId: d2.id,
        snapshotJson: { nodes: [{ id: "v2" }] },
      });
      await publishWorkflowVersionForTenant(prisma, { tenantId, workflowVersionId: d2.id, userId });

      const v1Row = await prisma.workflowVersion.findUnique({ where: { id: d1.id } });
      expect(v1Row?.status).toBe("SUPERSEDED");

      const forked = await forkWorkflowVersionDraftFromSourceForTenant(prisma, {
        tenantId,
        workflowTemplateId: tmpl.id,
        sourceWorkflowVersionId: d1.id,
      });
      if (forked === "not_found") throw new Error("unexpected not_found");
      expect(forked.versionNumber).toBe(3);
      expect(forked.snapshotJson).toEqual(snapV1);
      expect(forked.forkedFromWorkflowVersionId).toBe(d1.id);
      const forkRow = await prisma.workflowVersion.findUnique({
        where: { id: forked.id },
        select: { forkedFromWorkflowVersionId: true },
      });
      expect(forkRow?.forkedFromWorkflowVersionId).toBe(d1.id);
    } finally {
      await prisma.workflowVersion.deleteMany({ where: { workflowTemplate: { tenantId } } });
      await prisma.workflowTemplate.deleteMany({ where: { tenantId } });
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }
  });
});
