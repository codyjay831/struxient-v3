/**
 * Pure preflight assertion for the interim quote-local fork from a PUBLISHED
 * `ScopePacketRevision`.
 *
 * Operationalizes the two source-side preconditions canon §100-101 and bridge-
 * decision 03 require for a safe deep-copy fork: the source must be PUBLISHED
 * (the only canon-blessed library state, and the only state pickers expose),
 * and the source must not be empty (an empty fork is indistinguishable from
 * a `MANUAL_LOCAL` packet and would discard lineage for no reason). Kept
 * Prisma-free so it is fully unit-testable; the orchestrating mutation
 * (`forkScopePacketRevisionToQuoteLocalForTenant`) loads truth and feeds it in.
 *
 * Tenant ownership is intentionally NOT enforced here — the orchestrating
 * mutation handles it as a load-side `findFirst` filter and returns
 * `"not_found"` on miss, mirroring the promotion + publish patterns. That
 * keeps tenant safety as a gate-zero / 404 concern rather than a 4xx invariant.
 *
 * Target `QuoteVersion` DRAFT enforcement is delegated to the existing
 * `assertQuoteVersionDraft` invariant (QV-4); this assertion focuses on the
 * source revision's own state.
 *
 * Canon refs:
 *   - docs/canon/05-packet-canon.md §100-101 (Packet-level override policy:
 *     task mutation must fork to a QuoteLocalPacket as a deep copy)
 *   - docs/canon/05-packet-canon.md §159 / §161 (PUBLISHED-only picker discipline)
 *   - docs/bridge-decisions/03-packet-fork-promotion-decision.md
 */

import type { ScopePacketRevisionStatus } from "@prisma/client";
import { InvariantViolationError } from "../errors";

export type AssertScopePacketRevisionForkPreconditionsParams = {
  scopePacketId: string;
  scopePacketRevisionId: string;
  /** Current `status` of the source revision (loaded by caller). */
  currentStatus: ScopePacketRevisionStatus;
  /** Number of `PacketTaskLine` rows attached to the source revision. */
  packetTaskLineCount: number;
};

export function assertScopePacketRevisionForkPreconditions(
  params: AssertScopePacketRevisionForkPreconditionsParams,
): void {
  if (params.currentStatus !== "PUBLISHED") {
    throw new InvariantViolationError(
      "SCOPE_PACKET_REVISION_FORK_NOT_PUBLISHED",
      "ScopePacketRevision must be PUBLISHED to be forked into a quote-local copy; DRAFT revisions are not exposed to consumers.",
      {
        scopePacketId: params.scopePacketId,
        scopePacketRevisionId: params.scopePacketRevisionId,
        currentStatus: params.currentStatus,
      },
    );
  }

  if (params.packetTaskLineCount <= 0) {
    throw new InvariantViolationError(
      "SCOPE_PACKET_REVISION_FORK_SOURCE_HAS_NO_ITEMS",
      "ScopePacketRevision has no PacketTaskLine rows to copy; an empty fork is indistinguishable from a MANUAL_LOCAL packet and is rejected.",
      {
        scopePacketId: params.scopePacketId,
        scopePacketRevisionId: params.scopePacketRevisionId,
      },
    );
  }
}
