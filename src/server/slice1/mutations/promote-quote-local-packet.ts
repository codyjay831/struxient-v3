import { Prisma, type PrismaClient } from "@prisma/client";
import { InvariantViolationError } from "../errors";
import { assertQuoteVersionDraft } from "../invariants/quote-version";
import { assertQuoteLocalPacketTenantMatchesQuote } from "../invariants/quote-local-packet";
import { assertDisplayName, assertPacketKey } from "@/lib/quote-local-packet-input";
import { mapQuoteLocalPacketItemToPacketTaskLineCreate } from "@/lib/packet-promotion-mapping";

/**
 * Interim one-step promotion: `QuoteLocalPacket` → new `ScopePacket` + first `DRAFT` revision.
 *
 * Canon-authorized scope (do not widen):
 *   - Estimator-driven; estimator supplies `packetKey`.
 *   - Server validates `packetKey` (slug + tenant uniqueness).
 *   - Source `QuoteLocalPacket` must belong to tenant.
 *   - Source `QuoteVersion` must be `DRAFT`.
 *   - Source `QuoteLocalPacket.promotionStatus` must be `NONE`.
 *   - Server creates `ScopePacket` (tenant-scoped) and a first `ScopePacketRevision`
 *     with `revisionNumber = 1`, `status = DRAFT`, `publishedAt = null`.
 *   - Server copies every `QuoteLocalPacketItem` into a `PacketTaskLine` per the
 *     locked 1:1 mapping contract (see `src/lib/packet-promotion-mapping.ts`).
 *   - Server sets `promotionStatus = COMPLETED` and `promotedScopePacketId` on the source.
 *   - All-or-nothing in one transaction.
 *
 * Out of scope (preserved as deferred): admin-review queue, REQUESTED/IN_REVIEW/REJECTED
 * transitions, ScopePacket.status, PacketTier, publish flow, packetKey rename, rollback.
 *
 * Canon refs: docs/canon/05-packet-canon.md, docs/epics/15-scope-packets-epic.md §25a,
 * docs/implementation/decision-packs/interim-packet-promotion-decision-pack.md.
 */

export type PromoteQuoteLocalPacketInput = {
  tenantId: string;
  quoteLocalPacketId: string;
  userId: string;
  packetKey: unknown;
  displayName?: unknown;
};

export type PromoteQuoteLocalPacketResult = {
  quoteLocalPacketId: string;
  promotionStatus: "COMPLETED";
  promotedScopePacketId: string;
  scopePacket: {
    id: string;
    packetKey: string;
    displayName: string;
  };
  scopePacketRevision: {
    id: string;
    revisionNumber: number;
    status: "DRAFT";
    publishedAtIso: null;
    packetTaskLineCount: number;
  };
};

export async function promoteQuoteLocalPacketToCatalogForTenant(
  prisma: PrismaClient,
  input: PromoteQuoteLocalPacketInput,
): Promise<PromoteQuoteLocalPacketResult | "not_found"> {
  const packetKey = assertPacketKey(input.packetKey);
  const overrideDisplayName =
    input.displayName === undefined || input.displayName === null
      ? null
      : assertDisplayNameForPromotion(input.displayName);

  const source = await prisma.quoteLocalPacket.findFirst({
    where: {
      id: input.quoteLocalPacketId,
      tenantId: input.tenantId,
      quoteVersion: { quote: { tenantId: input.tenantId } },
    },
    select: {
      id: true,
      tenantId: true,
      quoteVersionId: true,
      displayName: true,
      promotionStatus: true,
      promotedScopePacketId: true,
      quoteVersion: {
        select: { id: true, status: true, quote: { select: { tenantId: true } } },
      },
      items: {
        orderBy: [{ sortOrder: "asc" }, { lineKey: "asc" }],
        select: {
          id: true,
          lineKey: true,
          sortOrder: true,
          tierCode: true,
          lineKind: true,
          embeddedPayloadJson: true,
          taskDefinitionId: true,
          targetNodeKey: true,
        },
      },
    },
  });
  if (!source) return "not_found";

  assertQuoteLocalPacketTenantMatchesQuote({
    packetTenantId: source.tenantId,
    packetQuoteVersionId: source.quoteVersionId,
    quoteTenantId: source.quoteVersion.quote.tenantId,
    quoteVersionId: source.quoteVersionId,
    quoteLocalPacketId: source.id,
  });
  assertQuoteVersionDraft({
    status: source.quoteVersion.status,
    quoteVersionId: source.quoteVersionId,
  });

  if (source.promotionStatus !== "NONE") {
    throw new InvariantViolationError(
      "QUOTE_LOCAL_PACKET_PROMOTION_ALREADY_PROMOTED",
      `QuoteLocalPacket promotionStatus is ${source.promotionStatus}; only NONE may be promoted in the interim slice.`,
      {
        quoteLocalPacketId: source.id,
        promotionStatus: source.promotionStatus,
        promotedScopePacketId: source.promotedScopePacketId,
      },
    );
  }
  if (source.items.length === 0) {
    throw new InvariantViolationError(
      "QUOTE_LOCAL_PACKET_PROMOTION_SOURCE_HAS_NO_ITEMS",
      "QuoteLocalPacket has no items to copy into a PacketTaskLine set; add at least one item before promotion.",
      { quoteLocalPacketId: source.id },
    );
  }

  // Pre-check uniqueness so we return the structured 409 before opening a transaction.
  // The unique index still guarantees correctness against races below.
  const collide = await prisma.scopePacket.findFirst({
    where: { tenantId: source.tenantId, packetKey },
    select: { id: true },
  });
  if (collide) {
    throw new InvariantViolationError(
      "QUOTE_LOCAL_PACKET_PROMOTION_PACKET_KEY_TAKEN",
      "Another ScopePacket on this tenant already uses this packetKey; choose a different key.",
      { packetKey, existingScopePacketId: collide.id },
    );
  }

  const displayName = overrideDisplayName ?? source.displayName;
  const lineCreates = source.items.map(mapQuoteLocalPacketItemToPacketTaskLineCreate);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const newPacket = await tx.scopePacket.create({
        data: {
          tenantId: source.tenantId,
          packetKey,
          displayName,
        },
        select: { id: true, packetKey: true, displayName: true },
      });

      const newRevision = await tx.scopePacketRevision.create({
        data: {
          scopePacketId: newPacket.id,
          revisionNumber: 1,
          status: "DRAFT",
          publishedAt: null,
        },
        select: { id: true, revisionNumber: true, status: true, publishedAt: true },
      });

      // The destination revision is brand new, so (scopePacketRevisionId, lineKey)
      // uniqueness is naturally satisfied by source-side uniqueness.
      for (const create of lineCreates) {
        await tx.packetTaskLine.create({
          data: {
            scopePacketRevisionId: newRevision.id,
            lineKey: create.lineKey,
            sortOrder: create.sortOrder,
            tierCode: create.tierCode,
            lineKind: create.lineKind,
            embeddedPayloadJson: create.embeddedPayloadJson as Prisma.InputJsonValue,
            taskDefinitionId: create.taskDefinitionId,
            targetNodeKey: create.targetNodeKey,
          },
        });
      }

      await tx.quoteLocalPacket.update({
        where: { id: source.id },
        data: {
          promotionStatus: "COMPLETED",
          promotedScopePacketId: newPacket.id,
          updatedById: input.userId,
        },
      });

      return { newPacket, newRevision };
    });

    return {
      quoteLocalPacketId: source.id,
      promotionStatus: "COMPLETED",
      promotedScopePacketId: result.newPacket.id,
      scopePacket: {
        id: result.newPacket.id,
        packetKey: result.newPacket.packetKey,
        displayName: result.newPacket.displayName,
      },
      scopePacketRevision: {
        id: result.newRevision.id,
        revisionNumber: result.newRevision.revisionNumber,
        status: "DRAFT",
        publishedAtIso: null,
        packetTaskLineCount: lineCreates.length,
      },
    };
  } catch (e) {
    // Race against another promotion that grabbed the same key first.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new InvariantViolationError(
        "QUOTE_LOCAL_PACKET_PROMOTION_PACKET_KEY_TAKEN",
        "Another ScopePacket on this tenant already uses this packetKey (concurrent insert); choose a different key.",
        { packetKey },
      );
    }
    throw e;
  }
}

function assertDisplayNameForPromotion(raw: unknown): string {
  try {
    return assertDisplayName(raw);
  } catch (e) {
    if (e instanceof InvariantViolationError) {
      throw new InvariantViolationError(
        "QUOTE_LOCAL_PACKET_PROMOTION_INVALID_DISPLAY_NAME",
        e.message,
        e.context,
      );
    }
    throw e;
  }
}
