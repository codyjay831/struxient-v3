import { describe, expect, it } from "vitest";
import { formatQuoteLocalPacketPromotionStatusLabel } from "./quote-local-packet-promotion-status-label";

describe("formatQuoteLocalPacketPromotionStatusLabel", () => {
  it("maps every canonical QuoteLocalPromotionStatus value to a humanized label", () => {
    expect(formatQuoteLocalPacketPromotionStatusLabel("NONE")).toBe("Not yet saved");
    expect(formatQuoteLocalPacketPromotionStatusLabel("REQUESTED")).toBe("Requested");
    expect(formatQuoteLocalPacketPromotionStatusLabel("IN_REVIEW")).toBe("In review");
    expect(formatQuoteLocalPacketPromotionStatusLabel("REJECTED")).toBe("Not approved");
    expect(formatQuoteLocalPacketPromotionStatusLabel("COMPLETED")).toBe("Saved to library");
  });

  it("falls back to a humanized title-cased label for unknown values (forward-compat)", () => {
    expect(formatQuoteLocalPacketPromotionStatusLabel("FUTURE_STATE")).toBe("Future state");
    expect(formatQuoteLocalPacketPromotionStatusLabel("foo")).toBe("Foo");
  });

  it("returns empty input unchanged (defensive)", () => {
    expect(formatQuoteLocalPacketPromotionStatusLabel("")).toBe("");
  });

  it("does not leak raw enum punctuation in fallback", () => {
    expect(formatQuoteLocalPacketPromotionStatusLabel("MULTI_WORD_THING")).toBe(
      "Multi word thing",
    );
  });
});
