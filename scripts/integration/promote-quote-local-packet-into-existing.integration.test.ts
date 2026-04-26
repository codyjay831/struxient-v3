import { describe, expect, it } from "vitest";
import { getPrisma } from "../../src/server/db/prisma";
import { promoteQuoteLocalPacketIntoExistingScopePacketForTenant } from "../../src/server/slice1/mutations/promote-quote-local-packet-into-existing";

/**
 * Promote-into-existing-saved-packet slice — direct mutation tests (no HTTP).
 *
 * Mirrors the harness pattern used by `task-definition-mutations.integration.test.ts`:
 * each scenario stands up a short-lived tenant + quote + saved packet,
 * exercises the mutation, and tears the rows down. Direct calls keep the test
 * fast and deterministic without depending on a live Next.js server.
 *
 * Coverage focus (Triangle Mode — verifier-first, smallest meaningful set):
 *   1. happy path: NEW DRAFT revision is created on the existing target with
 *      revisionNumber = max+1, items copied 1:1 in sortOrder/lineKey order,
 *      `embeddedPayloadJson` normalized (null → `{}`), source flips to
 *      COMPLETED with `promotedScopePacketId = target.id`. PUBLISHED revision
 *      stays untouched.
 *   2. blocked when target already has a DRAFT revision (canon §4 single-DRAFT).
 *   3. blocked when source quote-local packet has no items.
 *   4. blocked when source quote-local packet has already been promoted.
 *   5. tenant isolation: cross-tenant call returns "not_found".
 */
describe("promoteQuoteLocalPacketIntoExistingScopePacketForTenant — canon invariants", () => {
  it("happy path: copies items into a new DRAFT at max+1; PUBLISHED untouched; source COMPLETED", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `qlp-into-${suffix}`;
    await prisma.tenant.create({ data: { id: tenantId, name: "QLP Into" } });

    try {
      const userId = `u-${suffix}`;
      await prisma.user.create({
        data: { id: userId, tenantId, email: `office-${suffix}@test.com`, role: "OFFICE_ADMIN" },
      });
      const customer = await prisma.customer.create({ data: { tenantId, name: "C" } });
      const flowGroup = await prisma.flowGroup.create({
        data: { tenantId, customerId: customer.id, name: "FG" },
      });
      const quote = await prisma.quote.create({
        data: {
          tenantId,
          customerId: customer.id,
          flowGroupId: flowGroup.id,
          quoteNumber: `Q-${suffix}`,
        },
      });
      const quoteVersion = await prisma.quoteVersion.create({
        data: { quoteId: quote.id, versionNumber: 1, status: "DRAFT", createdById: userId },
      });

      // Target saved packet: 1 PUBLISHED revision (rN=1) with one PacketTaskLine
      // so we can confirm afterwards that PUBLISHED is left in place.
      const target = await prisma.scopePacket.create({
        data: {
          tenantId,
          packetKey: `pk-${suffix}`,
          displayName: "Target template",
        },
      });
      const publishedRev = await prisma.scopePacketRevision.create({
        data: {
          scopePacketId: target.id,
          revisionNumber: 1,
          status: "PUBLISHED",
          publishedAt: new Date(),
        },
      });
      await prisma.packetTaskLine.create({
        data: {
          scopePacketRevisionId: publishedRev.id,
          lineKey: "published-line",
          sortOrder: 0,
          tierCode: "GOOD",
          lineKind: "EMBEDDED",
          embeddedPayloadJson: { title: "Already published", taskKind: "LABOR" },
          targetNodeKey: "node-existing",
        },
      });

      // Source quote-local packet with two items (one EMBEDDED, one LIBRARY-with-null payload).
      const localPacket = await prisma.quoteLocalPacket.create({
        data: {
          tenantId,
          quoteVersionId: quoteVersion.id,
          displayName: "One-off work",
          originType: "MANUAL_LOCAL",
          createdById: userId,
        },
      });
      const taskDef = await prisma.taskDefinition.create({
        data: {
          tenantId,
          taskKey: `td-${suffix}`,
          displayName: "Reusable inspection",
          status: "PUBLISHED",
        },
      });
      await prisma.quoteLocalPacketItem.create({
        data: {
          quoteLocalPacketId: localPacket.id,
          lineKey: "embedded-1",
          sortOrder: 0,
          tierCode: "BETTER",
          lineKind: "EMBEDDED",
          embeddedPayloadJson: { title: "Embedded task", taskKind: "LABOR" },
          targetNodeKey: "node-a",
        },
      });
      await prisma.quoteLocalPacketItem.create({
        data: {
          quoteLocalPacketId: localPacket.id,
          lineKey: "library-1",
          sortOrder: 1,
          tierCode: null,
          lineKind: "LIBRARY",
          embeddedPayloadJson: undefined,
          taskDefinitionId: taskDef.id,
          targetNodeKey: "node-b",
        },
      });

      const result = await promoteQuoteLocalPacketIntoExistingScopePacketForTenant(prisma, {
        tenantId,
        quoteLocalPacketId: localPacket.id,
        targetScopePacketId: target.id,
        userId,
      });

      expect(result).not.toBe("not_found");
      if (result === "not_found") return;
      expect(result.scopePacket.id).toBe(target.id);
      expect(result.promotionStatus).toBe("COMPLETED");
      expect(result.promotedScopePacketId).toBe(target.id);
      expect(result.scopePacketRevision.status).toBe("DRAFT");
      expect(result.scopePacketRevision.publishedAtIso).toBeNull();
      expect(result.scopePacketRevision.revisionNumber).toBe(2); // max(1) + 1
      expect(result.scopePacketRevision.packetTaskLineCount).toBe(2);

      const allRevs = await prisma.scopePacketRevision.findMany({
        where: { scopePacketId: target.id },
        orderBy: { revisionNumber: "asc" },
        select: { id: true, revisionNumber: true, status: true, publishedAt: true },
      });
      expect(allRevs.length).toBe(2);
      expect(allRevs[0]).toMatchObject({
        revisionNumber: 1,
        status: "PUBLISHED",
      });
      expect(allRevs[0]?.publishedAt).not.toBeNull();
      expect(allRevs[1]).toMatchObject({
        revisionNumber: 2,
        status: "DRAFT",
        publishedAt: null,
      });

      const publishedLines = await prisma.packetTaskLine.findMany({
        where: { scopePacketRevisionId: publishedRev.id },
      });
      expect(publishedLines.length).toBe(1);
      expect(publishedLines[0]?.lineKey).toBe("published-line");

      const newDraftLines = await prisma.packetTaskLine.findMany({
        where: { scopePacketRevisionId: result.scopePacketRevision.id },
        orderBy: [{ sortOrder: "asc" }, { lineKey: "asc" }],
      });
      expect(newDraftLines.length).toBe(2);
      expect(newDraftLines[0]).toMatchObject({
        lineKey: "embedded-1",
        sortOrder: 0,
        tierCode: "BETTER",
        lineKind: "EMBEDDED",
        targetNodeKey: "node-a",
        taskDefinitionId: null,
      });
      expect(newDraftLines[0]?.embeddedPayloadJson).toMatchObject({
        title: "Embedded task",
        taskKind: "LABOR",
      });
      expect(newDraftLines[1]).toMatchObject({
        lineKey: "library-1",
        sortOrder: 1,
        tierCode: null,
        lineKind: "LIBRARY",
        targetNodeKey: "node-b",
        taskDefinitionId: taskDef.id,
      });
      // LIBRARY rows with null source payload normalize to `{}` per the
      // locked `mapQuoteLocalPacketItemToPacketTaskLineCreate` contract.
      expect(newDraftLines[1]?.embeddedPayloadJson).toEqual({});

      const refreshedSource = await prisma.quoteLocalPacket.findUnique({
        where: { id: localPacket.id },
        select: { promotionStatus: true, promotedScopePacketId: true, updatedById: true },
      });
      expect(refreshedSource).toMatchObject({
        promotionStatus: "COMPLETED",
        promotedScopePacketId: target.id,
        updatedById: userId,
      });
    } finally {
      await cleanupTenant(prisma, tenantId);
    }
  });

  it("blocks when target already has a DRAFT revision (TARGET_HAS_DRAFT)", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `qlp-into-${suffix}`;
    await prisma.tenant.create({ data: { id: tenantId, name: "QLP Into Draft" } });

    try {
      const ctx = await seedQuoteLocalPacket(prisma, tenantId, suffix, { withItem: true });

      // Target packet already has both a PUBLISHED and a DRAFT (e.g. from a
      // prior create-DRAFT-from-PUBLISHED call). The mutation must refuse so
      // single-DRAFT-per-packet stays canon.
      const target = await prisma.scopePacket.create({
        data: { tenantId, packetKey: `pk-${suffix}`, displayName: "Target" },
      });
      await prisma.scopePacketRevision.create({
        data: {
          scopePacketId: target.id,
          revisionNumber: 1,
          status: "PUBLISHED",
          publishedAt: new Date(),
        },
      });
      await prisma.scopePacketRevision.create({
        data: {
          scopePacketId: target.id,
          revisionNumber: 2,
          status: "DRAFT",
          publishedAt: null,
        },
      });

      await expect(
        promoteQuoteLocalPacketIntoExistingScopePacketForTenant(prisma, {
          tenantId,
          quoteLocalPacketId: ctx.localPacketId,
          targetScopePacketId: target.id,
          userId: ctx.userId,
        }),
      ).rejects.toMatchObject({
        code: "QUOTE_LOCAL_PACKET_PROMOTION_INTO_EXISTING_TARGET_HAS_DRAFT",
      });

      // Source must be untouched.
      const refreshed = await prisma.quoteLocalPacket.findUnique({
        where: { id: ctx.localPacketId },
        select: { promotionStatus: true, promotedScopePacketId: true },
      });
      expect(refreshed?.promotionStatus).toBe("NONE");
      expect(refreshed?.promotedScopePacketId).toBeNull();
    } finally {
      await cleanupTenant(prisma, tenantId);
    }
  });

  it("blocks when source has no items (SOURCE_HAS_NO_ITEMS)", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `qlp-into-${suffix}`;
    await prisma.tenant.create({ data: { id: tenantId, name: "QLP Into Empty" } });

    try {
      const ctx = await seedQuoteLocalPacket(prisma, tenantId, suffix, { withItem: false });
      const target = await prisma.scopePacket.create({
        data: { tenantId, packetKey: `pk-${suffix}`, displayName: "Target" },
      });

      await expect(
        promoteQuoteLocalPacketIntoExistingScopePacketForTenant(prisma, {
          tenantId,
          quoteLocalPacketId: ctx.localPacketId,
          targetScopePacketId: target.id,
          userId: ctx.userId,
        }),
      ).rejects.toMatchObject({
        code: "QUOTE_LOCAL_PACKET_PROMOTION_INTO_EXISTING_SOURCE_HAS_NO_ITEMS",
      });
    } finally {
      await cleanupTenant(prisma, tenantId);
    }
  });

  it("blocks when source has already been promoted (ALREADY_PROMOTED)", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `qlp-into-${suffix}`;
    await prisma.tenant.create({ data: { id: tenantId, name: "QLP Into Promoted" } });

    try {
      const ctx = await seedQuoteLocalPacket(prisma, tenantId, suffix, { withItem: true });
      const target = await prisma.scopePacket.create({
        data: { tenantId, packetKey: `pk-${suffix}`, displayName: "Target" },
      });

      // Simulate: this quote-local was already promoted by an earlier action.
      await prisma.quoteLocalPacket.update({
        where: { id: ctx.localPacketId },
        data: { promotionStatus: "COMPLETED", promotedScopePacketId: target.id },
      });

      await expect(
        promoteQuoteLocalPacketIntoExistingScopePacketForTenant(prisma, {
          tenantId,
          quoteLocalPacketId: ctx.localPacketId,
          targetScopePacketId: target.id,
          userId: ctx.userId,
        }),
      ).rejects.toMatchObject({
        code: "QUOTE_LOCAL_PACKET_PROMOTION_INTO_EXISTING_ALREADY_PROMOTED",
      });
    } finally {
      await cleanupTenant(prisma, tenantId);
    }
  });

  it("tenant isolation: cross-tenant call returns not_found (no info leak)", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantA = `qlp-into-a-${suffix}`;
    const tenantB = `qlp-into-b-${suffix}`;
    await prisma.tenant.create({ data: { id: tenantA, name: "QLP Into A" } });
    await prisma.tenant.create({ data: { id: tenantB, name: "QLP Into B" } });

    try {
      const ctxA = await seedQuoteLocalPacket(prisma, tenantA, suffix, { withItem: true });
      const targetA = await prisma.scopePacket.create({
        data: { tenantId: tenantA, packetKey: `pk-${suffix}`, displayName: "Target A" },
      });

      // Tenant B cannot see tenant A's quote-local packet at all.
      const resultBSource = await promoteQuoteLocalPacketIntoExistingScopePacketForTenant(
        prisma,
        {
          tenantId: tenantB,
          quoteLocalPacketId: ctxA.localPacketId,
          targetScopePacketId: targetA.id,
          userId: ctxA.userId,
        },
      );
      expect(resultBSource).toBe("not_found");

      // Tenant A's packet exists; cross-tenant target is also rejected as not_found.
      const targetB = await prisma.scopePacket.create({
        data: { tenantId: tenantB, packetKey: `pk-b-${suffix}`, displayName: "Target B" },
      });
      const resultBTarget = await promoteQuoteLocalPacketIntoExistingScopePacketForTenant(
        prisma,
        {
          tenantId: tenantA,
          quoteLocalPacketId: ctxA.localPacketId,
          targetScopePacketId: targetB.id,
          userId: ctxA.userId,
        },
      );
      expect(resultBTarget).toBe("not_found");
    } finally {
      await cleanupTenant(prisma, tenantA);
      await cleanupTenant(prisma, tenantB);
    }
  });
});

/* ───────────────────────── helpers ───────────────────────── */

async function seedQuoteLocalPacket(
  prisma: ReturnType<typeof getPrisma>,
  tenantId: string,
  suffix: string,
  opts: { withItem: boolean },
): Promise<{ userId: string; localPacketId: string }> {
  const userId = `u-${tenantId}`;
  await prisma.user.create({
    data: {
      id: userId,
      tenantId,
      email: `office-${tenantId}-${suffix}@test.com`,
      role: "OFFICE_ADMIN",
    },
  });
  const customer = await prisma.customer.create({ data: { tenantId, name: "C" } });
  const flowGroup = await prisma.flowGroup.create({
    data: { tenantId, customerId: customer.id, name: "FG" },
  });
  const quote = await prisma.quote.create({
    data: {
      tenantId,
      customerId: customer.id,
      flowGroupId: flowGroup.id,
      quoteNumber: `Q-${tenantId}`,
    },
  });
  const quoteVersion = await prisma.quoteVersion.create({
    data: { quoteId: quote.id, versionNumber: 1, status: "DRAFT", createdById: userId },
  });
  const localPacket = await prisma.quoteLocalPacket.create({
    data: {
      tenantId,
      quoteVersionId: quoteVersion.id,
      displayName: "Local",
      originType: "MANUAL_LOCAL",
      createdById: userId,
    },
  });
  if (opts.withItem) {
    await prisma.quoteLocalPacketItem.create({
      data: {
        quoteLocalPacketId: localPacket.id,
        lineKey: "item-1",
        sortOrder: 0,
        lineKind: "EMBEDDED",
        embeddedPayloadJson: { title: "T", taskKind: "LABOR" },
        targetNodeKey: "node-x",
      },
    });
  }
  return { userId, localPacketId: localPacket.id };
}

async function cleanupTenant(
  prisma: ReturnType<typeof getPrisma>,
  tenantId: string,
): Promise<void> {
  // Delete in dependency order — all relevant FKs on the chain we touch are
  // `Restrict`, so we drop leaves first and walk up to the tenant. Cascades
  // exist for some children (e.g. QuoteLocalPacket → Items) but explicit
  // deletes here keep the test resilient to schema relation-action churn.
  const packets = await prisma.scopePacket.findMany({
    where: { tenantId },
    select: { id: true },
  });
  for (const p of packets) {
    await prisma.packetTaskLine.deleteMany({
      where: { scopePacketRevision: { scopePacketId: p.id } },
    });
    await prisma.scopePacketRevision.deleteMany({ where: { scopePacketId: p.id } });
  }
  await prisma.scopePacket.deleteMany({ where: { tenantId } });

  // Quote-local packet items / packets first, then versions, then the quote
  // shells, then the dependents.
  await prisma.quoteLocalPacketItem.deleteMany({
    where: { quoteLocalPacket: { tenantId } },
  });
  await prisma.quoteLocalPacket.deleteMany({ where: { tenantId } });
  await prisma.quoteVersion.deleteMany({ where: { quote: { tenantId } } });
  await prisma.quote.deleteMany({ where: { tenantId } });

  await prisma.taskDefinition.deleteMany({ where: { tenantId } });
  await prisma.flowGroup.deleteMany({ where: { tenantId } });
  await prisma.customer.deleteMany({ where: { tenantId } });
  await prisma.user.deleteMany({ where: { tenantId } });
  await prisma.tenant.deleteMany({ where: { id: tenantId } });
}
