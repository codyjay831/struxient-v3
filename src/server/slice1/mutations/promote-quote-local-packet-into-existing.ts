import { Prisma, type PrismaClient } from "@prisma/client";
import { InvariantViolationError } from "../errors";
import { assertQuoteVersionDraft } from "../invariants/quote-version";
import { assertQuoteLocalPacketTenantMatchesQuote } from "../invariants/quote-local-packet";
import { assertPromoteQuoteLocalPacketIntoExistingPreconditions } from "../invariants/quote-local-packet-promote-into-existing";
import { mapQuoteLocalPacketItemToPacketTaskLineCreate } from "@/lib/packet-promotion-mapping";

/**
 * Promote a `QuoteLocalPacket` into an EXISTING `ScopePacket` as the next
 * editable DRAFT `ScopePacketRevision` (revision N+1, where N = the current
 * max revisionNumber across ALL revisions on the target packet).
 *
 * This is a sibling of {@link promoteQuoteLocalPacketToCatalogForTenant}
 * (promote-to-NEW-packet); the only structural difference is the target —
 * this path writes into a packet the user already owns instead of creating
 * a new ScopePacket. Both paths share the same source-side lifecycle
 * (`promotionStatus: NONE → COMPLETED`, `promotedScopePacketId` populated)
 * so a quote-local packet can only be promoted ONCE in total. We do this
 * deliberately to keep the promotion audit trail single-valued.
 *
 * Canon-authorized scope (do not widen):
 *   - office_mutate-gated; tenant ownership enforced via load-side filter on
 *     BOTH the source quote-local packet AND the target ScopePacket.
 *   - Source `QuoteVersion` must be DRAFT (mirrors promote-to-NEW).
 *   - Source `QuoteLocalPacket.promotionStatus` must be NONE (mirrors
 *     promote-to-NEW; enforced by
 *     `QUOTE_LOCAL_PACKET_PROMOTION_INTO_EXISTING_ALREADY_PROMOTED`).
 *   - Source must have ≥1 item (mirrors the empty-source rule).
 *   - Target must have NO existing DRAFT revision — single-DRAFT canon §4
 *     (enforced by `QUOTE_LOCAL_PACKET_PROMOTION_INTO_EXISTING_TARGET_HAS_DRAFT`,
 *     mirroring `SCOPE_PACKET_REVISION_CREATE_DRAFT_PACKET_HAS_DRAFT`).
 *   - The new revision uses `revisionNumber = max(across ALL revisions on the
 *     target) + 1` — never reuse a number, even when SUPERSEDED rows occupy
 *     lower numbers (mirrors the create-DRAFT-from-PUBLISHED writer).
 *   - Items copy 1:1 via the LOCKED mapping contract in
 *     `src/lib/packet-promotion-mapping.ts` (same helper the promote-to-NEW
 *     path uses).
 *   - All-or-nothing: revision-row insert + every PacketTaskLine insert +
 *     the source `promotionStatus` flip happen inside one
 *     `prisma.$transaction`.
 *
 * Out of scope (preserved as deferred):
 *   - Merging quote-local items with the target's latest PUBLISHED revision
 *     (the new DRAFT contains ONLY quote-local items — no merge UI).
 *   - Auto-publishing the new DRAFT.
 *   - Conflict-resolution UI for `lineKey` overlap with prior PUBLISHED
 *     content (the target's PUBLISHED revision stays untouched; conflicts
 *     can only happen *across* revisions, which is canon-allowed).
 *   - Editing the source `QuoteLocalPacket` post-promotion.
 *
 * Canon refs:
 *   - docs/canon/05-packet-canon.md
 *   - docs/implementation/decision-packs/interim-packet-promotion-decision-pack.md
 *   - docs/implementation/decision-packs/revision-2-evolution-decision-pack.md §4
 */

export type PromoteQuoteLocalPacketIntoExistingScopePacketInput = {
  tenantId: string;
  quoteLocalPacketId: string;
  targetScopePacketId: string;
  userId: string;
};

export type PromoteQuoteLocalPacketIntoExistingScopePacketResult = {
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

export async function promoteQuoteLocalPacketIntoExistingScopePacketForTenant(
  prisma: PrismaClient,
  input: PromoteQuoteLocalPacketIntoExistingScopePacketInput,
): Promise<PromoteQuoteLocalPacketIntoExistingScopePacketResult | "not_found"> {
  // Tenant ownership is the load-side filter on BOTH sides — null on either
  // ⇒ 404 (we don't leak the existence of a cross-tenant packet via a
  // distinct error). Mirrors the rest of the slice1 writers.
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

  const target = await prisma.scopePacket.findFirst({
    where: { id: input.targetScopePacketId, tenantId: input.tenantId },
    select: {
      id: true,
      packetKey: true,
      displayName: true,
      revisions: {
        orderBy: [{ revisionNumber: "desc" }],
        select: { id: true, revisionNumber: true, status: true },
      },
    },
  });
  if (!target) return "not_found";

  // Same shared invariant the promote-to-NEW path runs (tenant + version
  // mismatch defenses against schema-level inconsistency or bad input).
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

  const targetHasExistingDraft = target.revisions.some((r) => r.status === "DRAFT");

  assertPromoteQuoteLocalPacketIntoExistingPreconditions({
    quoteLocalPacketId: source.id,
    targetScopePacketId: target.id,
    sourcePromotionStatus: source.promotionStatus,
    sourceItemCount: source.items.length,
    targetHasExistingDraft,
  });

  // §3 cont. (mirrors create-DRAFT-from-PUBLISHED): revisionNumber is max
  // across ALL revisions (PUBLISHED, DRAFT, SUPERSEDED) + 1. Never reuse a
  // number even if a SUPERSEDED row sits at exactly N.
  const maxRevisionNumber = target.revisions.reduce(
    (max, r) => (r.revisionNumber > max ? r.revisionNumber : max),
    0,
  );
  const nextRevisionNumber = maxRevisionNumber + 1;

  const lineCreates = source.items.map(mapQuoteLocalPacketItemToPacketTaskLineCreate);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // In-tx race re-check on existing DRAFT — two concurrent promotion
      // calls (or one promotion + one create-DRAFT-from-PUBLISHED) cannot
      // both succeed. Mirrors the create-DRAFT-from-PUBLISHED writer's
      // pattern and surfaces the same canon error code regardless of which
      // call reaches the assertion first.
      const concurrentDraft = await tx.scopePacketRevision.findFirst({
        where: { scopePacketId: target.id, status: "DRAFT" },
        select: { id: true },
      });
      if (concurrentDraft) {
        assertPromoteQuoteLocalPacketIntoExistingPreconditions({
          quoteLocalPacketId: source.id,
          targetScopePacketId: target.id,
          sourcePromotionStatus: "NONE",
          sourceItemCount: source.items.length,
          targetHasExistingDraft: true,
        });
      }

      const newRevision = await tx.scopePacketRevision.create({
        data: {
          scopePacketId: target.id,
          revisionNumber: nextRevisionNumber,
          status: "DRAFT",
          publishedAt: null,
        },
        select: { id: true, revisionNumber: true, status: true, publishedAt: true },
      });

      // The destination revision is brand new, so (scopePacketRevisionId, lineKey)
      // uniqueness is naturally satisfied by source-side QuoteLocalPacketItem
      // uniqueness on (quoteLocalPacketId, lineKey) — same invariant the
      // promote-to-NEW path relies on.
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
          promotedScopePacketId: target.id,
          updatedById: input.userId,
        },
      });

      return { newRevision };
    });

    return {
      quoteLocalPacketId: source.id,
      promotionStatus: "COMPLETED",
      promotedScopePacketId: target.id,
      scopePacket: {
        id: target.id,
        packetKey: target.packetKey,
        displayName: target.displayName,
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
    // P2002 on (scopePacketId, revisionNumber) ⇒ another writer raced us
    // and inserted a row at our chosen number. The only legitimate parallel
    // writers are the create-DRAFT-from-PUBLISHED mutation and another
    // call into THIS mutation; both produce a DRAFT, so collapse the race
    // into the canon "target already has DRAFT" code so the API contract
    // stays stable for the caller.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new InvariantViolationError(
        "QUOTE_LOCAL_PACKET_PROMOTION_INTO_EXISTING_TARGET_HAS_DRAFT",
        "Target ScopePacket already has a DRAFT revision (concurrent insert detected); at most one DRAFT revision per packet is allowed.",
        {
          quoteLocalPacketId: input.quoteLocalPacketId,
          targetScopePacketId: input.targetScopePacketId,
        },
      );
    }
    throw e;
  }
}
