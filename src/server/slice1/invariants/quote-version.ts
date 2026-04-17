import type { QuoteVersionStatus } from "@prisma/client";
import { InvariantViolationError } from "../errors";

/**
 * QV-4: sent quote versions are immutable; draft-only mutations must assert this first.
 *
 * @see docs/schema-slice-1/04-slice-1-relations-and-invariants.md
 */
export function assertQuoteVersionDraft(params: {
  status: QuoteVersionStatus;
  quoteVersionId?: string;
}): void {
  if (params.status !== "DRAFT") {
    throw new InvariantViolationError(
      "QUOTE_VERSION_NOT_DRAFT",
      "Quote version must be DRAFT for this mutation; sent versions are immutable (QV-4).",
      { quoteVersionId: params.quoteVersionId, status: params.status },
    );
  }
}
