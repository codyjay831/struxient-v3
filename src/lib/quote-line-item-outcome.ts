/**
 * Pure UI helper that turns a workspace line-item's packet attachment shape
 * into a contractor-friendly outcome label.
 *
 * Why this lives at the UI layer (not the server):
 *   The workspace read DTO (`QuoteLineItemVisibilityDto`) intentionally does
 *   NOT expose the internal `executionMode` enum. It only exposes whether the
 *   line is library-backed or quote-local. We rely on a server invariant
 *   (`MANIFEST_SCOPE_PIN_XOR`) to guarantee that any persisted MANIFEST line
 *   has exactly one packet attached (library OR quote-local). That lets us
 *   derive the user-facing outcome from packet attachment alone.
 *
 * Outcome mapping (for persisted workspace data only):
 *   - `isLibraryBacked`              => "Field work — saved task packet"
 *   - `isQuoteLocal`                 => "Field work — on this quote"
 *   - neither attached               => "Quote-only"
 *
 * NOTE: A fourth "Field work — needs work template" outcome can exist while
 * editing a line in the Scope Editor (a draft MANIFEST with no packet yet),
 * but it cannot persist past save and therefore never appears in workspace
 * read data. The Scope Editor handles that draft-only state separately.
 */
export type QuoteLineItemOutcome =
  | "quote_only"
  | "field_work_saved"
  | "field_work_one_off";

export type QuoteLineItemOutcomeInput = {
  isLibraryBacked: boolean;
  isQuoteLocal: boolean;
};

export function deriveQuoteLineItemOutcome(
  input: QuoteLineItemOutcomeInput,
): QuoteLineItemOutcome {
  if (input.isLibraryBacked) return "field_work_saved";
  if (input.isQuoteLocal) return "field_work_one_off";
  return "quote_only";
}

export function formatQuoteLineItemOutcomeLabel(
  outcome: QuoteLineItemOutcome,
): string {
  switch (outcome) {
    case "quote_only":
      return "Quote-only";
    case "field_work_saved":
      return "Field work — saved task packet";
    case "field_work_one_off":
      return "Field work — on this quote";
  }
}

/**
 * Aggregate breakdown derived from the existing workspace summary counts.
 * Relies on `MANIFEST_SCOPE_PIN_XOR`: a line is library-backed XOR
 * quote-local XOR neither (quote-only). No server reads are added.
 */
export type QuoteLineItemOutcomeBreakdown = {
  total: number;
  quoteOnly: number;
  fieldWork: number;
  fieldWorkSaved: number;
  fieldWorkOneOff: number;
};

export function deriveQuoteLineItemOutcomeBreakdown(input: {
  lineItemCount: number;
  libraryLineItemCount: number;
  localLineItemCount: number;
}): QuoteLineItemOutcomeBreakdown {
  const fieldWorkSaved = input.libraryLineItemCount;
  const fieldWorkOneOff = input.localLineItemCount;
  const fieldWork = fieldWorkSaved + fieldWorkOneOff;
  const quoteOnly = Math.max(0, input.lineItemCount - fieldWork);
  return {
    total: input.lineItemCount,
    quoteOnly,
    fieldWork,
    fieldWorkSaved,
    fieldWorkOneOff,
  };
}
