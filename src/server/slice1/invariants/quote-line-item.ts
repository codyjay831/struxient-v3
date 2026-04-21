import { InvariantViolationError } from "../errors";
import { assertManifestScopePinXor } from "./manifest-scope";
import { assertQuoteLocalPacketTenantMatchesQuote } from "./quote-local-packet";

import type { QuoteLineItemExecutionMode, ScopePacketRevisionStatus } from "@prisma/client";

type ScopeRevisionTenantSlice = {
  id: string;
  status: ScopePacketRevisionStatus;
  scopePacket: { tenantId: string };
} | null;

/**
 * Pure assertion (write path): a `ScopePacketRevision` may only be pinned onto
 * a `QuoteLineItem.scopePacketRevisionId` when its `status === "PUBLISHED"`.
 *
 * This enforces the canon picker contract at the mutation boundary so that
 * neither a direct API caller nor a future picker bug can pin a DRAFT or
 * SUPERSEDED revision into new quote scope. The error code
 * `LINE_SCOPE_REVISION_NOT_PUBLISHED` and its 409 mapping are preserved
 * unchanged across the revision-2 evolution slice (decision pack §11).
 *
 * Canon refs:
 *   - docs/canon/05-packet-canon.md ("PUBLISHED revision discipline for pickers",
 *     "Canon amendment — revision-2 evolution policy (post-publish)")
 *   - docs/implementation/decision-packs/interim-packet-promotion-decision-pack.md §7
 *   - docs/implementation/decision-packs/revision-2-evolution-decision-pack.md §6, §11
 */
export function assertScopePacketRevisionIsPublishedForPin(params: {
  scopePacketRevisionId: string;
  status: ScopePacketRevisionStatus;
  quoteLineItemId?: string;
}): void {
  if (params.status === "PUBLISHED") return;
  throw new InvariantViolationError(
    "LINE_SCOPE_REVISION_NOT_PUBLISHED",
    "Pinned ScopePacketRevision must be PUBLISHED; only published revisions are valid quote-line scope.",
    {
      quoteLineItemId: params.quoteLineItemId,
      scopePacketRevisionId: params.scopePacketRevisionId,
      currentStatus: params.status,
    },
  );
}

/**
 * Pure assertion (read path only): an already-pinned `ScopePacketRevision`
 * loaded from the database resolves successfully when its `status` is in
 * `{ PUBLISHED, SUPERSEDED }`.
 *
 * Why this exists: under the revision-2 evolution decision pack §6, when a
 * revision N is demoted to SUPERSEDED on publish-of-N+1, all already-pinned
 * `QuoteLineItem.scopePacketRevisionId` rows that point at revision N must
 * continue to load successfully (history is preserved). The mutation-side
 * assertion above continues to refuse NEW pins to a non-PUBLISHED revision;
 * only the read path is broadened.
 *
 * Failure mode: a pin loaded from DB that resolves to anything outside the
 * read-set (today: only DRAFT) indicates either historical corruption or an
 * out-of-band status mutation. The dedicated `LINE_SCOPE_REVISION_PIN_INVALID_STATE`
 * code keeps that failure distinguishable from the user-facing
 * `LINE_SCOPE_REVISION_NOT_PUBLISHED` mutation rejection.
 *
 * Canon: docs/implementation/decision-packs/revision-2-evolution-decision-pack.md §6.
 */
export function assertScopePacketRevisionIsValidPinForReadModel(params: {
  scopePacketRevisionId: string;
  status: ScopePacketRevisionStatus;
  quoteLineItemId?: string;
}): void {
  if (params.status === "PUBLISHED" || params.status === "SUPERSEDED") return;
  throw new InvariantViolationError(
    "LINE_SCOPE_REVISION_PIN_INVALID_STATE",
    "Already-pinned ScopePacketRevision resolved to a status outside the read-set (PUBLISHED|SUPERSEDED); historical pin appears corrupted.",
    {
      quoteLineItemId: params.quoteLineItemId,
      scopePacketRevisionId: params.scopePacketRevisionId,
      currentStatus: params.status,
    },
  );
}

type LocalPacketSlice = {
  id: string;
  tenantId: string;
  quoteVersionId: string;
} | null;

/**
 * Acceptance mode for the scope-revision pin step inside
 * `assertQuoteLineItemInvariants`:
 *
 * - `"PUBLISHED_ONLY"` (default): mutation-side strict mode. Rejects DRAFT and
 *   SUPERSEDED with `LINE_SCOPE_REVISION_NOT_PUBLISHED` (canon picker contract).
 * - `"PUBLISHED_OR_SUPERSEDED"`: read-side broadened mode. Accepts both
 *   PUBLISHED and SUPERSEDED so historical pins to a now-demoted revision
 *   continue to load (revision-2 evolution decision pack §6).
 *
 * The mode is opt-in to keep every existing mutation call site PUBLISHED-only
 * by default; only the read-model invariant runner widens it.
 */
export type ScopePacketRevisionPinAcceptance =
  | "PUBLISHED_ONLY"
  | "PUBLISHED_OR_SUPERSEDED";

/**
 * QV-5 line / group version alignment + tenant-safe scope pins (library + local).
 *
 * The `pinAcceptance` parameter selects strict (write) vs broadened (read)
 * acceptance for the scope-revision status check. See
 * `ScopePacketRevisionPinAcceptance` for semantics. Mutation call sites use
 * the default `"PUBLISHED_ONLY"`; the read-side
 * `assertQuoteVersionScopeViewInvariants` passes `"PUBLISHED_OR_SUPERSEDED"`.
 *
 * @see docs/schema-slice-1/04-slice-1-relations-and-invariants.md
 * @see docs/implementation/decision-packs/revision-2-evolution-decision-pack.md §6
 */
export function assertQuoteLineItemInvariants(params: {
  quoteLineItemId?: string;
  quoteVersionId: string;
  proposalGroupId: string;
  proposalGroupQuoteVersionId: string;
  quoteTenantId: string;
  executionMode: QuoteLineItemExecutionMode;
  scopePacketRevisionId: string | null;
  quoteLocalPacketId: string | null;
  scopePacketRevision: ScopeRevisionTenantSlice;
  quoteLocalPacket: LocalPacketSlice;
  pinAcceptance?: ScopePacketRevisionPinAcceptance;
}): void {
  if (params.proposalGroupQuoteVersionId !== params.quoteVersionId) {
    throw new InvariantViolationError(
      "LINE_PROPOSAL_GROUP_VERSION_MISMATCH",
      "QuoteLineItem.quoteVersionId must match ProposalGroup.quoteVersionId",
      {
        quoteLineItemId: params.quoteLineItemId,
        proposalGroupId: params.proposalGroupId,
        quoteVersionId: params.quoteVersionId,
        proposalGroupQuoteVersionId: params.proposalGroupQuoteVersionId,
      },
    );
  }

  assertManifestScopePinXor({
    executionMode: params.executionMode,
    scopePacketRevisionId: params.scopePacketRevisionId,
    quoteLocalPacketId: params.quoteLocalPacketId,
    quoteLineItemId: params.quoteLineItemId,
  });

  if (params.scopePacketRevisionId != null) {
    if (!params.scopePacketRevision) {
      throw new InvariantViolationError(
        "READ_MODEL_INVARIANT_FAILURE",
        "QuoteLineItem references scopePacketRevisionId but scope relation is missing",
        { quoteLineItemId: params.quoteLineItemId, scopePacketRevisionId: params.scopePacketRevisionId },
      );
    }
    if (params.scopePacketRevision.scopePacket.tenantId !== params.quoteTenantId) {
      throw new InvariantViolationError(
        "LINE_SCOPE_REVISION_TENANT_MISMATCH",
        "Pinned ScopePacketRevision must belong to the same tenant as the quote",
        {
          quoteLineItemId: params.quoteLineItemId,
          scopePacketRevisionId: params.scopePacketRevisionId,
          revisionTenantId: params.scopePacketRevision.scopePacket.tenantId,
          quoteTenantId: params.quoteTenantId,
        },
      );
    }
    if (params.pinAcceptance === "PUBLISHED_OR_SUPERSEDED") {
      assertScopePacketRevisionIsValidPinForReadModel({
        scopePacketRevisionId: params.scopePacketRevisionId,
        status: params.scopePacketRevision.status,
        quoteLineItemId: params.quoteLineItemId,
      });
    } else {
      assertScopePacketRevisionIsPublishedForPin({
        scopePacketRevisionId: params.scopePacketRevisionId,
        status: params.scopePacketRevision.status,
        quoteLineItemId: params.quoteLineItemId,
      });
    }
  }

  if (params.quoteLocalPacketId != null) {
    if (!params.quoteLocalPacket) {
      throw new InvariantViolationError(
        "READ_MODEL_INVARIANT_FAILURE",
        "QuoteLineItem references quoteLocalPacketId but local packet relation is missing",
        { quoteLineItemId: params.quoteLineItemId, quoteLocalPacketId: params.quoteLocalPacketId },
      );
    }
    assertQuoteLocalPacketTenantMatchesQuote({
      packetTenantId: params.quoteLocalPacket.tenantId,
      packetQuoteVersionId: params.quoteLocalPacket.quoteVersionId,
      quoteTenantId: params.quoteTenantId,
      quoteVersionId: params.quoteVersionId,
      quoteLocalPacketId: params.quoteLocalPacket.id,
    });
  }
}
