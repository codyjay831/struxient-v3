/**
 * Maps the internal `QuoteLineItem.executionMode` enum to the contractor-
 * friendly label shown in primary user-facing UI (Triangle Mode UX — Slice A).
 *
 * Canon (do not move):
 *   - The enum stays `SOLD_SCOPE` / `MANIFEST` everywhere it's persisted,
 *     transmitted, or validated. This helper only governs the *rendered
 *     string* the contractor sees. DTOs, API payloads, server invariants,
 *     and DB columns continue to speak the raw enum.
 *   - Anything outside the supported set falls back to the input string
 *     unchanged so a future enum value (or a corrupted row) is at least
 *     visible rather than silently relabelled to one of the canon labels.
 *
 * Examples:
 *   formatExecutionModeLabel("SOLD_SCOPE") === "Quote-only"
 *   formatExecutionModeLabel("MANIFEST")   === "Field work"
 *   formatExecutionModeLabel("FUTURE")     === "FUTURE"
 */
export function formatExecutionModeLabel(executionMode: string): string {
  switch (executionMode) {
    case "SOLD_SCOPE":
      return "Quote-only";
    case "MANIFEST":
      return "Field work";
    default:
      return executionMode;
  }
}
