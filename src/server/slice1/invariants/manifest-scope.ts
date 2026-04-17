import type { QuoteLineItemExecutionMode } from "@prisma/client";
import { InvariantViolationError } from "../errors";

/**
 * Manifest lines must pin exactly one scope source (library revision XOR quote-local packet).
 * Duplicates DB CHECK for early, explicit failures and for contexts that bypass SQL (tests, raw SQL).
 *
 * @see docs/schema-slice-1/04-slice-1-relations-and-invariants.md — local packet path
 */
export function assertManifestScopePinXor(params: {
  executionMode: QuoteLineItemExecutionMode;
  scopePacketRevisionId: string | null;
  quoteLocalPacketId: string | null;
  quoteLineItemId?: string;
}): void {
  if (params.executionMode !== "MANIFEST") {
    return;
  }
  const hasLibrary = params.scopePacketRevisionId != null;
  const hasLocal = params.quoteLocalPacketId != null;
  if (hasLibrary === hasLocal) {
    throw new InvariantViolationError(
      "MANIFEST_SCOPE_PIN_XOR",
      hasLibrary
        ? "MANIFEST line cannot set both scopePacketRevisionId and quoteLocalPacketId"
        : "MANIFEST line must set exactly one of scopePacketRevisionId or quoteLocalPacketId",
      {
        quoteLineItemId: params.quoteLineItemId,
        scopePacketRevisionId: params.scopePacketRevisionId,
        quoteLocalPacketId: params.quoteLocalPacketId,
      },
    );
  }
}
