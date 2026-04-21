/**
 * Pure preflight assertion for the interim DRAFT → PUBLISHED transition on a
 * `ScopePacketRevision`.
 *
 * Operationalizes the canon-locked publish gates from the interim-publish-
 * authority decision pack as a single structured invariant. Kept Prisma-free
 * so it is fully unit-testable; the orchestrating mutation
 * (`publishScopePacketRevisionForTenant`) loads truth and feeds it in.
 *
 * Tenant ownership is intentionally NOT enforced here — the orchestrating
 * mutation handles it as a load-side `findFirst` filter and returns
 * `"not_found"` on miss, mirroring the promotion mutation pattern. That keeps
 * tenant safety as a gate-zero / 404 concern rather than a 409 invariant.
 *
 * Canon refs:
 *   - docs/canon/05-packet-canon.md ("Canon amendment — interim publish authority")
 *   - docs/implementation/decision-packs/interim-publish-authority-decision-pack.md
 *     §3 (canonical flow), §5 (preflight contract), §6 (multi-PUBLISHED policy)
 */

import type { ScopePacketRevisionStatus } from "@prisma/client";
import type { ScopePacketRevisionReadinessResult } from "@/lib/scope-packet-revision-readiness";
import { InvariantViolationError } from "../errors";

export type AssertScopePacketRevisionPublishPreconditionsParams = {
  scopePacketId: string;
  scopePacketRevisionId: string;
  /** Current `status` of the target revision (loaded by caller). */
  currentStatus: ScopePacketRevisionStatus;
  /**
   * Result of `evaluateScopePacketRevisionReadiness` against the same revision's
   * `PacketTaskLine` set. The publish writer must not invent or skip any gate
   * the predicate covers (decision pack §5).
   */
  readiness: ScopePacketRevisionReadinessResult;
  /**
   * `true` when at least one OTHER revision under the same `scopePacketId`
   * currently has `status = PUBLISHED`. Caller computes via a tiny indexed
   * existence check inside the publish transaction; passing it in as a
   * boolean keeps this assertion pure and fully unit-testable.
   *
   * Canon: at most one PUBLISHED revision per ScopePacket at a time
   * (decision pack §6).
   */
  packetHasOtherPublishedRevision: boolean;
};

export function assertScopePacketRevisionPublishPreconditions(
  params: AssertScopePacketRevisionPublishPreconditionsParams,
): void {
  if (params.currentStatus !== "DRAFT") {
    throw new InvariantViolationError(
      "SCOPE_PACKET_REVISION_PUBLISH_NOT_DRAFT",
      "ScopePacketRevision can only be published from DRAFT; current status forbids the transition.",
      {
        scopePacketId: params.scopePacketId,
        scopePacketRevisionId: params.scopePacketRevisionId,
        currentStatus: params.currentStatus,
      },
    );
  }

  if (!params.readiness.isReady) {
    throw new InvariantViolationError(
      "SCOPE_PACKET_REVISION_PUBLISH_NOT_READY",
      "ScopePacketRevision is not publish-ready; resolve the listed blockers in the source QuoteLocalPacket before publishing.",
      {
        scopePacketId: params.scopePacketId,
        scopePacketRevisionId: params.scopePacketRevisionId,
        blockers: params.readiness.blockers,
      },
    );
  }

  if (params.packetHasOtherPublishedRevision) {
    throw new InvariantViolationError(
      "SCOPE_PACKET_REVISION_PUBLISH_PACKET_HAS_PUBLISHED",
      "ScopePacket already has a PUBLISHED revision; the interim slice allows at most one PUBLISHED revision per packet at a time.",
      {
        scopePacketId: params.scopePacketId,
        scopePacketRevisionId: params.scopePacketRevisionId,
      },
    );
  }
}
