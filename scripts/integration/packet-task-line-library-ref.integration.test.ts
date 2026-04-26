import { describe, expect, it } from "vitest";
import { evaluateScopePacketRevisionReadiness } from "../../src/lib/scope-packet-revision-readiness";
import { getPrisma } from "../../src/server/db/prisma";
import { createGreenfieldScopePacketForTenant } from "../../src/server/slice1/mutations/create-greenfield-scope-packet-for-tenant";
import {
  createEmbeddedPacketTaskLineForLibraryDraftRevision,
  createLibraryRefPacketTaskLineForLibraryDraftRevision,
  deletePacketTaskLineForLibraryDraftRevision,
  reorderPacketTaskLineSortOrderForLibraryDraftRevision,
  updatePacketTaskLineForLibraryDraftRevision,
} from "../../src/server/slice1/mutations/packet-task-line-library-mutations";

/**
 * LIBRARY PacketTaskLine authoring on office-DRAFT revisions (Epic 16 narrow slice):
 * published TaskDefinition ref, `{}` embedded payload, tenant-safe validation, delete parity.
 */
describe("packet task line — LIBRARY ref on DRAFT scope packet revision", () => {
  it("creates LIBRARY line with PUBLISHED task definition, empty embedded payload, readiness ok, then deletes", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `ptl-lib-${suffix}`;
    const userId = `user-ptl-${suffix}`;

    await prisma.tenant.create({ data: { id: tenantId, name: "PTL Lib" } });
    await prisma.user.create({
      data: { id: userId, tenantId, email: `ptl-${suffix}@t.com`, role: "OFFICE_ADMIN" },
    });

    const td = await prisma.taskDefinition.create({
      data: {
        tenantId,
        taskKey: `tk-lib-${suffix}`,
        displayName: "Published for packet",
        status: "PUBLISHED",
      },
    });

    try {
      const { scopePacket, scopePacketRevision } = await createGreenfieldScopePacketForTenant(prisma, {
        tenantId,
        userId,
        displayName: `Lib line packet ${suffix}`,
      });

      const created = await createLibraryRefPacketTaskLineForLibraryDraftRevision(prisma, {
        tenantId,
        userId,
        scopePacketId: scopePacket.id,
        scopePacketRevisionId: scopePacketRevision.id,
        lineKey: "lib-row-1",
        targetNodeKey: "install",
        taskDefinitionId: td.id,
      });
      expect(created).not.toBe("not_found");
      if (created === "not_found") throw new Error("unexpected");

      const row = await prisma.packetTaskLine.findUniqueOrThrow({
        where: { id: created.id },
      });
      expect(row.lineKind).toBe("LIBRARY");
      expect(row.taskDefinitionId).toBe(td.id);
      expect(row.embeddedPayloadJson).toEqual({});
      expect(row.targetNodeKey).toBe("install");

      const withTd = await prisma.packetTaskLine.findMany({
        where: { scopePacketRevisionId: scopePacketRevision.id },
        include: { taskDefinition: { select: { id: true, status: true } } },
      });
      const readiness = evaluateScopePacketRevisionReadiness({
        packetTaskLines: withTd.map((l) => ({
          id: l.id,
          lineKey: l.lineKey,
          lineKind: l.lineKind,
          targetNodeKey: l.targetNodeKey,
          embeddedPayloadJson: l.embeddedPayloadJson,
          taskDefinitionId: l.taskDefinitionId,
          taskDefinition: l.taskDefinition ? { id: l.taskDefinition.id, status: l.taskDefinition.status } : null,
        })),
      });
      expect(readiness.isReady).toBe(true);

      const del = await deletePacketTaskLineForLibraryDraftRevision(prisma, {
        tenantId,
        userId,
        scopePacketId: scopePacket.id,
        scopePacketRevisionId: scopePacketRevision.id,
        packetTaskLineId: row.id,
      });
      expect(del).toBe("ok");
    } finally {
      await prisma.packetTaskLine.deleteMany({ where: { scopePacketRevision: { scopePacket: { tenantId } } } });
      await prisma.scopePacketRevision.deleteMany({ where: { scopePacket: { tenantId } } });
      await prisma.scopePacket.deleteMany({ where: { tenantId } });
      await prisma.taskDefinition.deleteMany({ where: { tenantId } });
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }
  });

  it("rejects DRAFT task definition", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `ptl-lib2-${suffix}`;
    const userId = `user-ptl2-${suffix}`;

    await prisma.tenant.create({ data: { id: tenantId, name: "PTL2" } });
    await prisma.user.create({
      data: { id: userId, tenantId, email: `ptl2-${suffix}@t.com`, role: "OFFICE_ADMIN" },
    });

    const td = await prisma.taskDefinition.create({
      data: {
        tenantId,
        taskKey: `tk-draft-${suffix}`,
        displayName: "Draft def",
        status: "DRAFT",
      },
    });

    try {
      const { scopePacket, scopePacketRevision } = await createGreenfieldScopePacketForTenant(prisma, {
        tenantId,
        userId,
        displayName: `Packet ${suffix}`,
      });

      await expect(
        createLibraryRefPacketTaskLineForLibraryDraftRevision(prisma, {
          tenantId,
          userId,
          scopePacketId: scopePacket.id,
          scopePacketRevisionId: scopePacketRevision.id,
          lineKey: "x",
          targetNodeKey: "n",
          taskDefinitionId: td.id,
        }),
      ).rejects.toMatchObject({ code: "SCOPE_PACKET_TASK_LINE_TASK_DEFINITION_NOT_PUBLISHED" });
    } finally {
      await prisma.packetTaskLine.deleteMany({ where: { scopePacketRevision: { scopePacket: { tenantId } } } });
      await prisma.scopePacketRevision.deleteMany({ where: { scopePacket: { tenantId } } });
      await prisma.scopePacket.deleteMany({ where: { tenantId } });
      await prisma.taskDefinition.deleteMany({ where: { tenantId } });
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }
  });

  it("rejects unknown task definition id", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `ptl-lib3-${suffix}`;
    const userId = `user-ptl3-${suffix}`;

    await prisma.tenant.create({ data: { id: tenantId, name: "PTL3" } });
    await prisma.user.create({
      data: { id: userId, tenantId, email: `ptl3-${suffix}@t.com`, role: "OFFICE_ADMIN" },
    });

    try {
      const { scopePacket, scopePacketRevision } = await createGreenfieldScopePacketForTenant(prisma, {
        tenantId,
        userId,
        displayName: `Packet ${suffix}`,
      });

      await expect(
        createLibraryRefPacketTaskLineForLibraryDraftRevision(prisma, {
          tenantId,
          userId,
          scopePacketId: scopePacket.id,
          scopePacketRevisionId: scopePacketRevision.id,
          lineKey: "x",
          targetNodeKey: "n",
          taskDefinitionId: "nonexistent-id",
        }),
      ).rejects.toMatchObject({ code: "TASK_DEFINITION_NOT_FOUND" });
    } finally {
      await prisma.scopePacketRevision.deleteMany({ where: { scopePacket: { tenantId } } });
      await prisma.scopePacket.deleteMany({ where: { tenantId } });
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }
  });

  it("LIBRARY + EMBEDDED together satisfy publish readiness", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `ptl-mix-${suffix}`;
    const userId = `user-ptl-m-${suffix}`;

    await prisma.tenant.create({ data: { id: tenantId, name: "PTL Mix" } });
    await prisma.user.create({
      data: { id: userId, tenantId, email: `ptlm-${suffix}@t.com`, role: "OFFICE_ADMIN" },
    });

    const td = await prisma.taskDefinition.create({
      data: {
        tenantId,
        taskKey: `tk-pub-${suffix}`,
        displayName: "Pub",
        status: "PUBLISHED",
      },
    });

    try {
      const { scopePacket, scopePacketRevision } = await createGreenfieldScopePacketForTenant(prisma, {
        tenantId,
        userId,
        displayName: `Mix packet ${suffix}`,
      });

      await createEmbeddedPacketTaskLineForLibraryDraftRevision(prisma, {
        tenantId,
        userId,
        scopePacketId: scopePacket.id,
        scopePacketRevisionId: scopePacketRevision.id,
        lineKey: "emb-1",
        targetNodeKey: "install",
        title: "T",
      });

      await createLibraryRefPacketTaskLineForLibraryDraftRevision(prisma, {
        tenantId,
        userId,
        scopePacketId: scopePacket.id,
        scopePacketRevisionId: scopePacketRevision.id,
        lineKey: "lib-1",
        targetNodeKey: "final-inspection",
        taskDefinitionId: td.id,
      });

      const withTd = await prisma.packetTaskLine.findMany({
        where: { scopePacketRevisionId: scopePacketRevision.id },
        include: { taskDefinition: { select: { id: true, status: true } } },
        orderBy: { sortOrder: "asc" },
      });
      const readiness = evaluateScopePacketRevisionReadiness({
        packetTaskLines: withTd.map((l) => ({
          id: l.id,
          lineKey: l.lineKey,
          lineKind: l.lineKind,
          targetNodeKey: l.targetNodeKey,
          embeddedPayloadJson: l.embeddedPayloadJson,
          taskDefinitionId: l.taskDefinitionId,
          taskDefinition: l.taskDefinition ? { id: l.taskDefinition.id, status: l.taskDefinition.status } : null,
        })),
      });
      expect(readiness.isReady).toBe(true);
    } finally {
      await prisma.packetTaskLine.deleteMany({ where: { scopePacketRevision: { scopePacket: { tenantId } } } });
      await prisma.scopePacketRevision.deleteMany({ where: { scopePacket: { tenantId } } });
      await prisma.scopePacket.deleteMany({ where: { tenantId } });
      await prisma.taskDefinition.deleteMany({ where: { tenantId } });
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }
  });
});

describe("packet task line — reorder sortOrder (DRAFT revision)", () => {
  it("moves second line up; list order and sortOrder renumber 0..n-1", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `ptl-ord-${suffix}`;
    const userId = `user-ord-${suffix}`;

    await prisma.tenant.create({ data: { id: tenantId, name: "Ord" } });
    await prisma.user.create({
      data: { id: userId, tenantId, email: `ord-${suffix}@t.com`, role: "OFFICE_ADMIN" },
    });

    try {
      const { scopePacket, scopePacketRevision } = await createGreenfieldScopePacketForTenant(prisma, {
        tenantId,
        userId,
        displayName: `Ord pkt ${suffix}`,
      });

      const first = await createEmbeddedPacketTaskLineForLibraryDraftRevision(prisma, {
        tenantId,
        userId,
        scopePacketId: scopePacket.id,
        scopePacketRevisionId: scopePacketRevision.id,
        lineKey: "aaa-first",
        targetNodeKey: "install",
        title: "A",
      });
      const second = await createEmbeddedPacketTaskLineForLibraryDraftRevision(prisma, {
        tenantId,
        userId,
        scopePacketId: scopePacket.id,
        scopePacketRevisionId: scopePacketRevision.id,
        lineKey: "bbb-second",
        targetNodeKey: "final-inspection",
        title: "B",
      });
      if (first === "not_found" || second === "not_found") throw new Error("unexpected");

      const ok = await reorderPacketTaskLineSortOrderForLibraryDraftRevision(prisma, {
        tenantId,
        userId,
        scopePacketId: scopePacket.id,
        scopePacketRevisionId: scopePacketRevision.id,
        packetTaskLineId: second.id,
        direction: "up",
      });
      expect(ok).toBe("ok");

      const ordered = await prisma.packetTaskLine.findMany({
        where: { scopePacketRevisionId: scopePacketRevision.id },
        orderBy: [{ sortOrder: "asc" }, { lineKey: "asc" }],
        select: { id: true, lineKey: true, sortOrder: true },
      });
      expect(ordered.map((r) => r.lineKey)).toEqual(["bbb-second", "aaa-first"]);
      expect(ordered.map((r) => r.sortOrder)).toEqual([0, 1]);
    } finally {
      await prisma.packetTaskLine.deleteMany({ where: { scopePacketRevision: { scopePacket: { tenantId } } } });
      await prisma.scopePacketRevision.deleteMany({ where: { scopePacket: { tenantId } } });
      await prisma.scopePacket.deleteMany({ where: { tenantId } });
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }
  });

  it("rejects move up on first line", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `ptl-ordb-${suffix}`;
    const userId = `user-ordb-${suffix}`;

    await prisma.tenant.create({ data: { id: tenantId, name: "Ordb" } });
    await prisma.user.create({
      data: { id: userId, tenantId, email: `ordb-${suffix}@t.com`, role: "OFFICE_ADMIN" },
    });

    try {
      const { scopePacket, scopePacketRevision } = await createGreenfieldScopePacketForTenant(prisma, {
        tenantId,
        userId,
        displayName: `Ordb ${suffix}`,
      });
      const a = await createEmbeddedPacketTaskLineForLibraryDraftRevision(prisma, {
        tenantId,
        userId,
        scopePacketId: scopePacket.id,
        scopePacketRevisionId: scopePacketRevision.id,
        lineKey: "only-a",
        targetNodeKey: "n",
        title: "A",
      });
      if (a === "not_found") throw new Error("unexpected");

      await expect(
        reorderPacketTaskLineSortOrderForLibraryDraftRevision(prisma, {
          tenantId,
          userId,
          scopePacketId: scopePacket.id,
          scopePacketRevisionId: scopePacketRevision.id,
          packetTaskLineId: a.id,
          direction: "up",
        }),
      ).rejects.toMatchObject({ code: "SCOPE_PACKET_TASK_LINE_REORDER_AT_BOUNDARY" });
    } finally {
      await prisma.packetTaskLine.deleteMany({ where: { scopePacketRevision: { scopePacket: { tenantId } } } });
      await prisma.scopePacketRevision.deleteMany({ where: { scopePacket: { tenantId } } });
      await prisma.scopePacket.deleteMany({ where: { tenantId } });
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }
  });

  it("normalizes duplicate sortOrder values after one move", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `ptl-ordd-${suffix}`;
    const userId = `user-ordd-${suffix}`;

    await prisma.tenant.create({ data: { id: tenantId, name: "Ordd" } });
    await prisma.user.create({
      data: { id: userId, tenantId, email: `ordd-${suffix}@t.com`, role: "OFFICE_ADMIN" },
    });

    try {
      const { scopePacket, scopePacketRevision } = await createGreenfieldScopePacketForTenant(prisma, {
        tenantId,
        userId,
        displayName: `Ordd ${suffix}`,
      });
      const a = await createEmbeddedPacketTaskLineForLibraryDraftRevision(prisma, {
        tenantId,
        userId,
        scopePacketId: scopePacket.id,
        scopePacketRevisionId: scopePacketRevision.id,
        lineKey: "dup-a",
        targetNodeKey: "n",
        title: "A",
      });
      const b = await createEmbeddedPacketTaskLineForLibraryDraftRevision(prisma, {
        tenantId,
        userId,
        scopePacketId: scopePacket.id,
        scopePacketRevisionId: scopePacketRevision.id,
        lineKey: "dup-b",
        targetNodeKey: "n",
        title: "B",
      });
      if (a === "not_found" || b === "not_found") throw new Error("unexpected");

      await prisma.packetTaskLine.updateMany({
        where: { scopePacketRevisionId: scopePacketRevision.id },
        data: { sortOrder: 99 },
      });

      await reorderPacketTaskLineSortOrderForLibraryDraftRevision(prisma, {
        tenantId,
        userId,
        scopePacketId: scopePacket.id,
        scopePacketRevisionId: scopePacketRevision.id,
        packetTaskLineId: b.id,
        direction: "up",
      });

      const ordered = await prisma.packetTaskLine.findMany({
        where: { scopePacketRevisionId: scopePacketRevision.id },
        orderBy: [{ sortOrder: "asc" }, { lineKey: "asc" }],
        select: { lineKey: true, sortOrder: true },
      });
      expect(ordered.map((r) => r.sortOrder)).toEqual([0, 1]);
      expect(ordered.map((r) => r.lineKey)).toEqual(["dup-b", "dup-a"]);
    } finally {
      await prisma.packetTaskLine.deleteMany({ where: { scopePacketRevision: { scopePacket: { tenantId } } } });
      await prisma.scopePacketRevision.deleteMany({ where: { scopePacket: { tenantId } } });
      await prisma.scopePacket.deleteMany({ where: { tenantId } });
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }
  });

  it("publish readiness unchanged in substance after reorder (EMBEDDED + LIBRARY)", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `ptl-ordr-${suffix}`;
    const userId = `user-ordr-${suffix}`;

    await prisma.tenant.create({ data: { id: tenantId, name: "Ordr" } });
    await prisma.user.create({
      data: { id: userId, tenantId, email: `ordr-${suffix}@t.com`, role: "OFFICE_ADMIN" },
    });
    const td = await prisma.taskDefinition.create({
      data: { tenantId, taskKey: `tk-ord-${suffix}`, displayName: "Pub", status: "PUBLISHED" },
    });

    try {
      const { scopePacket, scopePacketRevision } = await createGreenfieldScopePacketForTenant(prisma, {
        tenantId,
        userId,
        displayName: `Ordr ${suffix}`,
      });
      await createEmbeddedPacketTaskLineForLibraryDraftRevision(prisma, {
        tenantId,
        userId,
        scopePacketId: scopePacket.id,
        scopePacketRevisionId: scopePacketRevision.id,
        lineKey: "z-emb",
        targetNodeKey: "install",
        title: "E",
      });
      const lib = await createLibraryRefPacketTaskLineForLibraryDraftRevision(prisma, {
        tenantId,
        userId,
        scopePacketId: scopePacket.id,
        scopePacketRevisionId: scopePacketRevision.id,
        lineKey: "a-lib",
        targetNodeKey: "final-inspection",
        taskDefinitionId: td.id,
      });
      if (lib === "not_found") throw new Error("unexpected");

      const readReady = async () => {
        const rows = await prisma.packetTaskLine.findMany({
          where: { scopePacketRevisionId: scopePacketRevision.id },
          include: { taskDefinition: { select: { id: true, status: true } } },
          orderBy: [{ sortOrder: "asc" }, { lineKey: "asc" }],
        });
        return evaluateScopePacketRevisionReadiness({
          packetTaskLines: rows.map((l) => ({
            id: l.id,
            lineKey: l.lineKey,
            lineKind: l.lineKind,
            targetNodeKey: l.targetNodeKey,
            embeddedPayloadJson: l.embeddedPayloadJson,
            taskDefinitionId: l.taskDefinitionId,
            taskDefinition: l.taskDefinition ? { id: l.taskDefinition.id, status: l.taskDefinition.status } : null,
          })),
        });
      };

      const before = await readReady();
      await reorderPacketTaskLineSortOrderForLibraryDraftRevision(prisma, {
        tenantId,
        userId,
        scopePacketId: scopePacket.id,
        scopePacketRevisionId: scopePacketRevision.id,
        packetTaskLineId: lib.id,
        direction: "up",
      });
      const after = await readReady();
      expect(before.isReady).toBe(after.isReady);
      expect(before.blockers.map((b) => b.code).sort()).toEqual(after.blockers.map((b) => b.code).sort());
    } finally {
      await prisma.packetTaskLine.deleteMany({ where: { scopePacketRevision: { scopePacket: { tenantId } } } });
      await prisma.scopePacketRevision.deleteMany({ where: { scopePacket: { tenantId } } });
      await prisma.scopePacket.deleteMany({ where: { tenantId } });
      await prisma.taskDefinition.deleteMany({ where: { tenantId } });
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }
  });
});

describe("packet task line — edit-in-place (DRAFT revision)", () => {
  it("updates EMBEDDED targetNodeKey, tierCode, title, and taskKind", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `ptl-ed-${suffix}`;
    const userId = `user-ed-${suffix}`;

    await prisma.tenant.create({ data: { id: tenantId, name: "Ed" } });
    await prisma.user.create({
      data: { id: userId, tenantId, email: `ed-${suffix}@t.com`, role: "OFFICE_ADMIN" },
    });

    try {
      const { scopePacket, scopePacketRevision } = await createGreenfieldScopePacketForTenant(prisma, {
        tenantId,
        userId,
        displayName: `Ed pkt ${suffix}`,
      });
      const row = await createEmbeddedPacketTaskLineForLibraryDraftRevision(prisma, {
        tenantId,
        userId,
        scopePacketId: scopePacket.id,
        scopePacketRevisionId: scopePacketRevision.id,
        lineKey: "ed-1",
        targetNodeKey: "n-old",
        title: "Old title",
        taskKind: "INSTALL",
      });
      if (row === "not_found") throw new Error("unexpected");

      await prisma.packetTaskLine.update({
        where: { id: row.id },
        data: { tierCode: "T1" },
      });

      const ok = await updatePacketTaskLineForLibraryDraftRevision(prisma, {
        tenantId,
        userId,
        scopePacketId: scopePacket.id,
        scopePacketRevisionId: scopePacketRevision.id,
        packetTaskLineId: row.id,
        patch: {
          targetNodeKey: "n-new",
          tierCode: "",
          title: "New title",
          taskKind: "LABOR",
        },
      });
      expect(ok).toBe("ok");

      const after = await prisma.packetTaskLine.findUniqueOrThrow({ where: { id: row.id } });
      expect(after.targetNodeKey).toBe("n-new");
      expect(after.tierCode).toBeNull();
      const emb = after.embeddedPayloadJson as Record<string, unknown>;
      expect(emb.title).toBe("New title");
      expect(emb.taskKind).toBe("LABOR");
    } finally {
      await prisma.packetTaskLine.deleteMany({ where: { scopePacketRevision: { scopePacket: { tenantId } } } });
      await prisma.scopePacketRevision.deleteMany({ where: { scopePacket: { tenantId } } });
      await prisma.scopePacket.deleteMany({ where: { tenantId } });
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }
  });

  it("rejects title patch on LIBRARY line", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `ptl-edl-${suffix}`;
    const userId = `user-edl-${suffix}`;

    await prisma.tenant.create({ data: { id: tenantId, name: "Edl" } });
    await prisma.user.create({
      data: { id: userId, tenantId, email: `edl-${suffix}@t.com`, role: "OFFICE_ADMIN" },
    });
    const td = await prisma.taskDefinition.create({
      data: { tenantId, taskKey: `tk-edl-${suffix}`, displayName: "P", status: "PUBLISHED" },
    });

    try {
      const { scopePacket, scopePacketRevision } = await createGreenfieldScopePacketForTenant(prisma, {
        tenantId,
        userId,
        displayName: `Edl ${suffix}`,
      });
      const row = await createLibraryRefPacketTaskLineForLibraryDraftRevision(prisma, {
        tenantId,
        userId,
        scopePacketId: scopePacket.id,
        scopePacketRevisionId: scopePacketRevision.id,
        lineKey: "lib-ed",
        targetNodeKey: "install",
        taskDefinitionId: td.id,
      });
      if (row === "not_found") throw new Error("unexpected");

      await expect(
        updatePacketTaskLineForLibraryDraftRevision(prisma, {
          tenantId,
          userId,
          scopePacketId: scopePacket.id,
          scopePacketRevisionId: scopePacketRevision.id,
          packetTaskLineId: row.id,
          patch: { title: "Nope" },
        }),
      ).rejects.toMatchObject({ code: "SCOPE_PACKET_TASK_LINE_EDIT_EMBEDDED_FIELDS_ON_LIBRARY" });
    } finally {
      await prisma.packetTaskLine.deleteMany({ where: { scopePacketRevision: { scopePacket: { tenantId } } } });
      await prisma.scopePacketRevision.deleteMany({ where: { scopePacket: { tenantId } } });
      await prisma.scopePacket.deleteMany({ where: { tenantId } });
      await prisma.taskDefinition.deleteMany({ where: { tenantId } });
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }
  });

  it("allows LIBRARY targetNodeKey and tierCode only", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `ptl-edl2-${suffix}`;
    const userId = `user-edl2-${suffix}`;

    await prisma.tenant.create({ data: { id: tenantId, name: "Edl2" } });
    await prisma.user.create({
      data: { id: userId, tenantId, email: `edl2-${suffix}@t.com`, role: "OFFICE_ADMIN" },
    });
    const td = await prisma.taskDefinition.create({
      data: { tenantId, taskKey: `tk-edl2-${suffix}`, displayName: "P2", status: "PUBLISHED" },
    });

    try {
      const { scopePacket, scopePacketRevision } = await createGreenfieldScopePacketForTenant(prisma, {
        tenantId,
        userId,
        displayName: `Edl2 ${suffix}`,
      });
      const row = await createLibraryRefPacketTaskLineForLibraryDraftRevision(prisma, {
        tenantId,
        userId,
        scopePacketId: scopePacket.id,
        scopePacketRevisionId: scopePacketRevision.id,
        lineKey: "lib-ed2",
        targetNodeKey: "x1",
        taskDefinitionId: td.id,
      });
      if (row === "not_found") throw new Error("unexpected");

      await updatePacketTaskLineForLibraryDraftRevision(prisma, {
        tenantId,
        userId,
        scopePacketId: scopePacket.id,
        scopePacketRevisionId: scopePacketRevision.id,
        packetTaskLineId: row.id,
        patch: { targetNodeKey: "x2", tierCode: "gold" },
      });

      const after = await prisma.packetTaskLine.findUniqueOrThrow({ where: { id: row.id } });
      expect(after.targetNodeKey).toBe("x2");
      expect(after.tierCode).toBe("gold");
      expect(after.embeddedPayloadJson).toEqual({});
    } finally {
      await prisma.packetTaskLine.deleteMany({ where: { scopePacketRevision: { scopePacket: { tenantId } } } });
      await prisma.scopePacketRevision.deleteMany({ where: { scopePacket: { tenantId } } });
      await prisma.scopePacket.deleteMany({ where: { tenantId } });
      await prisma.taskDefinition.deleteMany({ where: { tenantId } });
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }
  });

  it("rejects empty patch", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `ptl-ede-${suffix}`;
    const userId = `user-ede-${suffix}`;

    await prisma.tenant.create({ data: { id: tenantId, name: "Ede" } });
    await prisma.user.create({
      data: { id: userId, tenantId, email: `ede-${suffix}@t.com`, role: "OFFICE_ADMIN" },
    });

    try {
      const { scopePacket, scopePacketRevision } = await createGreenfieldScopePacketForTenant(prisma, {
        tenantId,
        userId,
        displayName: `Ede ${suffix}`,
      });
      const row = await createEmbeddedPacketTaskLineForLibraryDraftRevision(prisma, {
        tenantId,
        userId,
        scopePacketId: scopePacket.id,
        scopePacketRevisionId: scopePacketRevision.id,
        lineKey: "e",
        targetNodeKey: "n",
        title: "T",
      });
      if (row === "not_found") throw new Error("unexpected");

      await expect(
        updatePacketTaskLineForLibraryDraftRevision(prisma, {
          tenantId,
          userId,
          scopePacketId: scopePacket.id,
          scopePacketRevisionId: scopePacketRevision.id,
          packetTaskLineId: row.id,
          patch: {},
        }),
      ).rejects.toMatchObject({ code: "SCOPE_PACKET_TASK_LINE_EDIT_EMPTY_PATCH" });
    } finally {
      await prisma.packetTaskLine.deleteMany({ where: { scopePacketRevision: { scopePacket: { tenantId } } } });
      await prisma.scopePacketRevision.deleteMany({ where: { scopePacket: { tenantId } } });
      await prisma.scopePacket.deleteMany({ where: { tenantId } });
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }
  });

  it("publish readiness unchanged for a valid EMBEDDED title edit", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `ptl-edr-${suffix}`;
    const userId = `user-edr-${suffix}`;

    await prisma.tenant.create({ data: { id: tenantId, name: "Edr" } });
    await prisma.user.create({
      data: { id: userId, tenantId, email: `edr-${suffix}@t.com`, role: "OFFICE_ADMIN" },
    });

    try {
      const { scopePacket, scopePacketRevision } = await createGreenfieldScopePacketForTenant(prisma, {
        tenantId,
        userId,
        displayName: `Edr ${suffix}`,
      });
      const row = await createEmbeddedPacketTaskLineForLibraryDraftRevision(prisma, {
        tenantId,
        userId,
        scopePacketId: scopePacket.id,
        scopePacketRevisionId: scopePacketRevision.id,
        lineKey: "r1",
        targetNodeKey: "n",
        title: "Hello",
      });
      if (row === "not_found") throw new Error("unexpected");

      const readReady = async () => {
        const rows = await prisma.packetTaskLine.findMany({
          where: { scopePacketRevisionId: scopePacketRevision.id },
          include: { taskDefinition: { select: { id: true, status: true } } },
          orderBy: [{ sortOrder: "asc" }, { lineKey: "asc" }],
        });
        return evaluateScopePacketRevisionReadiness({
          packetTaskLines: rows.map((l) => ({
            id: l.id,
            lineKey: l.lineKey,
            lineKind: l.lineKind,
            targetNodeKey: l.targetNodeKey,
            embeddedPayloadJson: l.embeddedPayloadJson,
            taskDefinitionId: l.taskDefinitionId,
            taskDefinition: l.taskDefinition ? { id: l.taskDefinition.id, status: l.taskDefinition.status } : null,
          })),
        });
      };

      const before = await readReady();
      await updatePacketTaskLineForLibraryDraftRevision(prisma, {
        tenantId,
        userId,
        scopePacketId: scopePacket.id,
        scopePacketRevisionId: scopePacketRevision.id,
        packetTaskLineId: row.id,
        patch: { title: "Hello there" },
      });
      const after = await readReady();
      expect(before.isReady).toBe(true);
      expect(after.isReady).toBe(true);
    } finally {
      await prisma.packetTaskLine.deleteMany({ where: { scopePacketRevision: { scopePacket: { tenantId } } } });
      await prisma.scopePacketRevision.deleteMany({ where: { scopePacket: { tenantId } } });
      await prisma.scopePacket.deleteMany({ where: { tenantId } });
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }
  });
});
