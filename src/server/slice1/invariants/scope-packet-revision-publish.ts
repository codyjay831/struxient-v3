/**
 * Pure preflight assertion for the DRAFT → PUBLISHED transition on a
 * `ScopePacketRevision`.
 *
 * Operationalizes the canon-locked publish gates as a single structured
 * invariant. Kept Prisma-free so it is fully unit-testable; the orchestrating
 * mutation (`publishScopePacketRevisionForTenant`) loads truth and feeds it in.
 *
 * Tenant ownership is intentionally NOT enforced here — the orchestrating
 * mutation handles it as a load-side `findFirst` filter and returns
 * `"not_found"` on miss, mirroring the promotion mutation pattern. That keeps
 * tenant safety as a gate-zero / 404 concern rather than a 409 invariant.
 *
 * Sibling-PUBLISHED handling: under the revision-2 evolution decision pack
 * §5, the "at most one PUBLISHED revision per packet" invariant is preserved
 * by the publish writer transactionally demoting any sibling PUBLISHED row to
 * SUPERSEDED — not by rejecting the publish here. Consequently this assertion
 * no longer takes a `packetHasOtherPublishedRevision` parameter and the prior
 * `SCOPE_PACKET_REVISION_PUBLISH_PACKET_HAS_PUBLISHED` rejection branch is
 * retired (decision pack §13). The `currentStatus = DRAFT` gate alone now
 * blocks both re-publish of PUBLISHED and the canon-forbidden publish of a
 * SUPERSEDED revision.
 *
 * Canon refs:
 *   - docs/canon/05-packet-canon.md ("Canon amendment — interim publish authority",
 *     "Canon amendment — revision-2 evolution policy (post-publish)")
 *   - docs/implementation/decision-packs/interim-publish-authority-decision-pack.md
 *   - docs/implementation/decision-packs/revision-2-evolution-decision-pack.md §5, §13
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
   * the predicate covers.
   */
  readiness: ScopePacketRevisionReadinessResult;
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
}
