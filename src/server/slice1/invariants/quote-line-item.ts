import { InvariantViolationError } from "../errors";
import { assertManifestScopePinXor } from "./manifest-scope";
import { assertQuoteLocalPacketTenantMatchesQuote } from "./quote-local-packet";

import type { QuoteLineItemExecutionMode } from "@prisma/client";

type ScopeRevisionTenantSlice = {
  id: string;
  scopePacket: { tenantId: string };
} | null;

type LocalPacketSlice = {
  id: string;
  tenantId: string;
  quoteVersionId: string;
} | null;

/**
 * QV-5 line / group version alignment + tenant-safe scope pins (library + local).
 *
 * @see docs/schema-slice-1/04-slice-1-relations-and-invariants.md
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
