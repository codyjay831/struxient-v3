/**
 * Pure preflight assertion for the create-DRAFT-from-PUBLISHED transition on
 * a `ScopePacket` (revision-2 evolution).
 *
 * Operationalizes the three canon-locked refusals from the revision-2
 * evolution decision pack as a single structured invariant:
 *
 * - §3 source policy: there must be at least one PUBLISHED revision on the
 *   packet to clone from. No PUBLISHED ⇒
 *   `SCOPE_PACKET_REVISION_CREATE_DRAFT_NO_PUBLISHED_SOURCE`.
 * - §4 multi-DRAFT policy: at most one DRAFT revision per packet. Existing
 *   DRAFT ⇒ `SCOPE_PACKET_REVISION_CREATE_DRAFT_PACKET_HAS_DRAFT`.
 * - Defensive parity with the promotion / fork empty-source rule: cloning an
 *   empty PUBLISHED revision would silently produce an empty DRAFT, which
 *   has no path to publish (the readiness predicate requires at least one
 *   line). Empty source ⇒ `SCOPE_PACKET_REVISION_CREATE_DRAFT_SOURCE_HAS_NO_ITEMS`.
 *
 * Tenant ownership is intentionally NOT enforced here — the orchestrating
 * mutation handles it as a load-side `findFirst` filter and returns
 * `"not_found"` on miss, mirroring the promotion / publish writers.
 *
 * Canon refs:
 *   - docs/canon/05-packet-canon.md ("Canon amendment — revision-2 evolution
 *     policy (post-publish)")
 *   - docs/implementation/decision-packs/revision-2-evolution-decision-pack.md §3, §4
 */

import { InvariantViolationError } from "../errors";

export type AssertCreateDraftScopePacketRevisionPreconditionsParams = {
  scopePacketId: string;
  /** True when at least one revision under the packet has `status = PUBLISHED`. */
  hasPublishedSource: boolean;
  /** True when at least one revision under the packet has `status = DRAFT`. */
  hasExistingDraft: boolean;
  /**
   * Number of `PacketTaskLine` rows on the source PUBLISHED revision selected
   * by the writer (the highest-`revisionNumber` PUBLISHED revision). 0 ⇒
   * empty-source rejection.
   */
  sourceTaskLineCount: number;
};

export function assertCreateDraftScopePacketRevisionPreconditions(
  params: AssertCreateDraftScopePacketRevisionPreconditionsParams,
): void {
  if (!params.hasPublishedSource) {
    throw new InvariantViolationError(
      "SCOPE_PACKET_REVISION_CREATE_DRAFT_NO_PUBLISHED_SOURCE",
      "ScopePacket has no PUBLISHED revision; the next DRAFT revision must be cloned from a PUBLISHED source.",
      { scopePacketId: params.scopePacketId },
    );
  }

  if (params.hasExistingDraft) {
    throw new InvariantViolationError(
      "SCOPE_PACKET_REVISION_CREATE_DRAFT_PACKET_HAS_DRAFT",
      "ScopePacket already has a DRAFT revision; at most one DRAFT revision per packet is allowed.",
      { scopePacketId: params.scopePacketId },
    );
  }

  if (params.sourceTaskLineCount <= 0) {
    throw new InvariantViolationError(
      "SCOPE_PACKET_REVISION_CREATE_DRAFT_SOURCE_HAS_NO_ITEMS",
      "Source PUBLISHED revision has no PacketTaskLine rows; cannot clone an empty revision.",
      { scopePacketId: params.scopePacketId },
    );
  }
}
