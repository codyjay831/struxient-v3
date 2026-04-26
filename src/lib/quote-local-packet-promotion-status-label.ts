/**
 * Maps the internal `QuoteLocalPacket.promotionStatus` enum to the contractor-
 * friendly label shown in primary user-facing UI (Packets Epic closeout —
 * UX/copy normalization).
 *
 * Canon (do not move):
 *   - The enum stays `NONE` / `REQUESTED` / `IN_REVIEW` / `REJECTED` /
 *     `COMPLETED` everywhere it is persisted, transmitted, or validated. This
 *     helper only governs the *rendered string* the contractor sees. DTOs,
 *     API payloads, server invariants, and DB columns continue to speak the
 *     raw enum.
 *   - Anything outside the supported set falls back to a humanized
 *     title-cased version of the input so a future enum value (or a corrupted
 *     row) is at least visible rather than silently relabelled.
 *
 * Examples:
 *   formatQuoteLocalPacketPromotionStatusLabel("NONE")      === "Not yet saved"
 *   formatQuoteLocalPacketPromotionStatusLabel("COMPLETED") === "Saved to library"
 *   formatQuoteLocalPacketPromotionStatusLabel("FUTURE")    === "Future"
 */
export function formatQuoteLocalPacketPromotionStatusLabel(
  promotionStatus: string,
): string {
  switch (promotionStatus) {
    case "NONE":
      return "Not yet saved";
    case "REQUESTED":
      return "Requested";
    case "IN_REVIEW":
      return "In review";
    case "REJECTED":
      return "Not approved";
    case "COMPLETED":
      return "Saved to library";
    default:
      return humanizeFallback(promotionStatus);
  }
}

function humanizeFallback(raw: string): string {
  if (raw.length === 0) return raw;
  const lower = raw.toLowerCase().replace(/_/g, " ");
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
