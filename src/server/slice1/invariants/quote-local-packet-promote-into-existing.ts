/**
 * Pure preflight assertion for the *promote-into-existing-saved-packet* path:
 * a `QuoteLocalPacket` is copied into an existing `ScopePacket` as the next
 * editable DRAFT `ScopePacketRevision`.
 *
 * The three canon-locked refusals operate on a different family of inputs
 * than the existing promote-to-NEW-packet path
 * ({@link assertCreateDraftScopePacketRevisionPreconditions} clones from
 * PUBLISHED; this one clones from a `QuoteLocalPacket`):
 *
 * - Source-already-promoted: a quote-local packet may only be promoted once
 *   (mirrors the lifecycle the existing one-step path enforces). Anything
 *   other than `promotionStatus = NONE` ⇒
 *   `QUOTE_LOCAL_PACKET_PROMOTION_INTO_EXISTING_ALREADY_PROMOTED`.
 * - Source-empty: zero-item promotions silently produce empty DRAFT revisions
 *   that have no path to publish (`PUBLISHED_READINESS` requires ≥1 line).
 *   Empty source ⇒ `QUOTE_LOCAL_PACKET_PROMOTION_INTO_EXISTING_SOURCE_HAS_NO_ITEMS`.
 * - Target-has-DRAFT: at most one DRAFT revision per packet (canon §4 — single
 *   DRAFT per packet). Existing DRAFT on the target ⇒
 *   `QUOTE_LOCAL_PACKET_PROMOTION_INTO_EXISTING_TARGET_HAS_DRAFT`.
 *
 * Tenant ownership is intentionally NOT enforced here — the orchestrating
 * mutation handles it as a load-side `findFirst` filter on both source AND
 * target and returns `"not_found"` on miss, mirroring the rest of the
 * promotion / publish writers.
 *
 * Note: we do NOT require the target packet to have an existing PUBLISHED
 * revision. Promote-into-existing must work against a packet whose only
 * revisions are SUPERSEDED (or even DRAFT-once-deleted, in a future slice),
 * because the *source of truth for the lines* is the quote-local packet,
 * not the prior published catalog content. This is the canon-locked
 * difference vs. the create-DRAFT-from-PUBLISHED path.
 *
 * Canon refs:
 *   - docs/canon/05-packet-canon.md (single-DRAFT canon §4)
 *   - docs/implementation/decision-packs/interim-packet-promotion-decision-pack.md
 *   - docs/implementation/decision-packs/revision-2-evolution-decision-pack.md §4
 */

import { InvariantViolationError } from "../errors";

export type AssertPromoteQuoteLocalPacketIntoExistingPreconditionsParams = {
  quoteLocalPacketId: string;
  targetScopePacketId: string;
  /** `QuoteLocalPacket.promotionStatus` from the loaded source row. */
  sourcePromotionStatus:
    | "NONE"
    | "REQUESTED"
    | "IN_REVIEW"
    | "REJECTED"
    | "COMPLETED";
  /** Number of `QuoteLocalPacketItem` rows on the source. 0 ⇒ empty rejection. */
  sourceItemCount: number;
  /** True when at least one revision on the target has `status = DRAFT`. */
  targetHasExistingDraft: boolean;
};

export function assertPromoteQuoteLocalPacketIntoExistingPreconditions(
  params: AssertPromoteQuoteLocalPacketIntoExistingPreconditionsParams,
): void {
  if (params.sourcePromotionStatus !== "NONE") {
    throw new InvariantViolationError(
      "QUOTE_LOCAL_PACKET_PROMOTION_INTO_EXISTING_ALREADY_PROMOTED",
      `QuoteLocalPacket promotionStatus is ${params.sourcePromotionStatus}; only NONE may be promoted into an existing saved template.`,
      {
        quoteLocalPacketId: params.quoteLocalPacketId,
        targetScopePacketId: params.targetScopePacketId,
        sourcePromotionStatus: params.sourcePromotionStatus,
      },
    );
  }

  if (params.sourceItemCount <= 0) {
    throw new InvariantViolationError(
      "QUOTE_LOCAL_PACKET_PROMOTION_INTO_EXISTING_SOURCE_HAS_NO_ITEMS",
      "QuoteLocalPacket has no items to copy into a PacketTaskLine set; add at least one item before promoting into an existing saved template.",
      {
        quoteLocalPacketId: params.quoteLocalPacketId,
        targetScopePacketId: params.targetScopePacketId,
      },
    );
  }

  if (params.targetHasExistingDraft) {
    throw new InvariantViolationError(
      "QUOTE_LOCAL_PACKET_PROMOTION_INTO_EXISTING_TARGET_HAS_DRAFT",
      "Target ScopePacket already has a DRAFT revision; at most one DRAFT revision per packet is allowed. Open the existing draft and merge changes there instead.",
      {
        quoteLocalPacketId: params.quoteLocalPacketId,
        targetScopePacketId: params.targetScopePacketId,
      },
    );
  }
}
