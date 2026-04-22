import { describe, expect, it } from "vitest";
import { getPrisma } from "../../src/server/db/prisma";
import { createGreenfieldScopePacketForTenant } from "../../src/server/slice1/mutations/create-greenfield-scope-packet-for-tenant";
import { createEmbeddedPacketTaskLineForLibraryDraftRevision } from "../../src/server/slice1/mutations/packet-task-line-library-mutations";
import { publishScopePacketRevisionForTenant } from "../../src/server/slice1/mutations/publish-scope-packet-revision";
import { promoteQuoteLocalPacketToCatalogForTenant } from "../../src/server/slice1/mutations/promote-quote-local-packet";
import { InvariantViolationError } from "../../src/server/slice1/errors";

/**
 * Epic 15 greenfield: `ScopePacket` + r1 DRAFT without promotion; publish after adding one EMBEDDED line via
 * the supported library draft mutation (Epic 16).
 */
describe("greenfield ScopePacket create", () => {
  it("creates packet + empty r1 DRAFT, derives key, then publishes after a minimal EMBEDDED line", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `gf-pkt-${suffix}`;
    const userId = `user-gf-${suffix}`;

    await prisma.tenant.create({ data: { id: tenantId, name: "GF Tenant" } });
    await prisma.user.create({
      data: { id: userId, tenantId, email: `gf-${suffix}@t.com`, role: "OFFICE_ADMIN" },
    });

    try {
      const created = await createGreenfieldScopePacketForTenant(prisma, {
        tenantId,
        userId,
        displayName: "Greenfield Test Packet",
      });
      expect(created.scopePacket.packetKey).toBe("greenfield-test-packet");
      expect(created.scopePacketRevision.revisionNumber).toBe(1);
      expect(created.scopePacketRevision.status).toBe("DRAFT");

      const revRow = await prisma.scopePacketRevision.findUniqueOrThrow({
        where: { id: created.scopePacketRevision.id },
        include: { packetTaskLines: true },
      });
      expect(revRow.packetTaskLines.length).toBe(0);

      const line = await createEmbeddedPacketTaskLineForLibraryDraftRevision(prisma, {
        tenantId,
        userId,
        scopePacketId: created.scopePacket.id,
        scopePacketRevisionId: created.scopePacketRevision.id,
        lineKey: "line-1",
        targetNodeKey: "install-node",
        title: "Install scope",
        taskKind: "INSTALL",
      });
      expect(line).not.toBe("not_found");
      if (line === "not_found") throw new Error("unexpected");
      expect(line.lineKey).toBe("line-1");

      const pub = await publishScopePacketRevisionForTenant(prisma, {
        tenantId,
        scopePacketId: created.scopePacket.id,
        scopePacketRevisionId: created.scopePacketRevision.id,
        userId,
      });
      expect(pub).not.toBe("not_found");
      if (pub === "not_found") throw new Error("unexpected");
      expect(pub.status).toBe("PUBLISHED");
      expect(pub.demotedSiblingCount).toBe(0);

      const dup = createGreenfieldScopePacketForTenant(prisma, {
        tenantId,
        userId,
        displayName: "Other",
        packetKey: "greenfield-test-packet",
      });
      await expect(dup).rejects.toThrow(InvariantViolationError);

      await expect(
        createEmbeddedPacketTaskLineForLibraryDraftRevision(prisma, {
          tenantId,
          userId,
          scopePacketId: created.scopePacket.id,
          scopePacketRevisionId: created.scopePacketRevision.id,
          lineKey: "after-publish",
          targetNodeKey: "n",
          title: "Too late",
        }),
      ).rejects.toThrow(InvariantViolationError);
    } finally {
      await prisma.packetTaskLine.deleteMany({ where: { scopePacketRevision: { scopePacket: { tenantId } } } });
      await prisma.scopePacketRevision.deleteMany({ where: { scopePacket: { tenantId } } });
      await prisma.scopePacket.deleteMany({ where: { tenantId } });
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }
  });

  it("does not break promotion path on same tenant (independent packets)", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `gf-promo-${suffix}`;
    const userId = `user-gf2-${suffix}`;

    await prisma.tenant.create({ data: { id: tenantId, name: "GF2" } });
    await prisma.user.create({
      data: { id: userId, tenantId, email: `gf2-${suffix}@t.com`, role: "OFFICE_ADMIN" },
    });
    const customer = await prisma.customer.create({ data: { tenantId, name: "C" } });
    const fg = await prisma.flowGroup.create({ data: { tenantId, customerId: customer.id, name: "FG" } });
    const quote = await prisma.quote.create({
      data: { tenantId, customerId: customer.id, flowGroupId: fg.id, quoteNumber: `Q-${suffix}` },
    });
    const qv = await prisma.quoteVersion.create({
      data: { quoteId: quote.id, versionNumber: 1, status: "DRAFT", createdById: userId },
    });
    const qlp = await prisma.quoteLocalPacket.create({
      data: {
        tenantId,
        quoteVersionId: qv.id,
        displayName: "Local",
        originType: "MANUAL_LOCAL",
        createdById: userId,
      },
    });
    await prisma.quoteLocalPacketItem.create({
      data: {
        quoteLocalPacketId: qlp.id,
        lineKey: "a",
        sortOrder: 0,
        lineKind: "EMBEDDED",
        targetNodeKey: "n1",
        embeddedPayloadJson: { title: "T", taskKind: "LABOR" },
      },
    });

    try {
      await createGreenfieldScopePacketForTenant(prisma, {
        tenantId,
        userId,
        displayName: "Parallel greenfield",
        packetKey: `gf-parallel-${suffix}`,
      });

      const promo = await promoteQuoteLocalPacketToCatalogForTenant(prisma, {
        tenantId,
        quoteLocalPacketId: qlp.id,
        userId,
        packetKey: `promo-${suffix}`,
        displayName: "Promoted",
      });
      expect(promo).not.toBe("not_found");
      if (promo === "not_found") throw new Error("unexpected");
      expect(promo.scopePacketRevision.status).toBe("DRAFT");
      expect(promo.scopePacketRevision.packetTaskLineCount).toBe(1);
    } finally {
      await prisma.packetTaskLine.deleteMany({
        where: { scopePacketRevision: { scopePacket: { tenantId } } },
      });
      await prisma.scopePacketRevision.deleteMany({ where: { scopePacket: { tenantId } } });
      await prisma.scopePacket.deleteMany({ where: { tenantId } });
      await prisma.quoteLocalPacketItem.deleteMany({ where: { quoteLocalPacket: { tenantId } } });
      await prisma.quoteLocalPacket.deleteMany({ where: { tenantId } });
      await prisma.quoteVersion.deleteMany({ where: { quoteId: quote.id } });
      await prisma.quote.deleteMany({ where: { id: quote.id } });
      await prisma.flowGroup.deleteMany({ where: { id: fg.id } });
      await prisma.customer.deleteMany({ where: { id: customer.id } });
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }
  });
});
