import { describe, expect, it } from "vitest";
import { assertPromoteQuoteLocalPacketIntoExistingPreconditions } from "./quote-local-packet-promote-into-existing";
import { InvariantViolationError } from "../errors";

function expectInvariant(fn: () => unknown, code: string): void {
  try {
    fn();
    throw new Error("expected InvariantViolationError to be thrown");
  } catch (e) {
    expect(e).toBeInstanceOf(InvariantViolationError);
    if (e instanceof InvariantViolationError) {
      expect(e.code).toBe(code);
    }
  }
}

const baseValid = {
  quoteLocalPacketId: "qlp_1",
  targetScopePacketId: "sp_1",
  sourcePromotionStatus: "NONE" as const,
  sourceItemCount: 2,
  targetHasExistingDraft: false,
};

describe("assertPromoteQuoteLocalPacketIntoExistingPreconditions", () => {
  it("accepts the canon-valid input shape (NONE, ≥1 item, no existing DRAFT)", () => {
    expect(() =>
      assertPromoteQuoteLocalPacketIntoExistingPreconditions(baseValid),
    ).not.toThrow();
  });

  it("rejects sourcePromotionStatus=COMPLETED with ALREADY_PROMOTED", () => {
    expectInvariant(
      () =>
        assertPromoteQuoteLocalPacketIntoExistingPreconditions({
          ...baseValid,
          sourcePromotionStatus: "COMPLETED",
        }),
      "QUOTE_LOCAL_PACKET_PROMOTION_INTO_EXISTING_ALREADY_PROMOTED",
    );
  });

  it.each(["REQUESTED", "IN_REVIEW", "REJECTED"] as const)(
    "rejects sourcePromotionStatus=%s with ALREADY_PROMOTED",
    (status) => {
      expectInvariant(
        () =>
          assertPromoteQuoteLocalPacketIntoExistingPreconditions({
            ...baseValid,
            sourcePromotionStatus: status,
          }),
        "QUOTE_LOCAL_PACKET_PROMOTION_INTO_EXISTING_ALREADY_PROMOTED",
      );
    },
  );

  it("rejects sourceItemCount=0 with SOURCE_HAS_NO_ITEMS", () => {
    expectInvariant(
      () =>
        assertPromoteQuoteLocalPacketIntoExistingPreconditions({
          ...baseValid,
          sourceItemCount: 0,
        }),
      "QUOTE_LOCAL_PACKET_PROMOTION_INTO_EXISTING_SOURCE_HAS_NO_ITEMS",
    );
  });

  it("rejects negative sourceItemCount with SOURCE_HAS_NO_ITEMS (defensive)", () => {
    expectInvariant(
      () =>
        assertPromoteQuoteLocalPacketIntoExistingPreconditions({
          ...baseValid,
          sourceItemCount: -1,
        }),
      "QUOTE_LOCAL_PACKET_PROMOTION_INTO_EXISTING_SOURCE_HAS_NO_ITEMS",
    );
  });

  it("rejects targetHasExistingDraft=true with TARGET_HAS_DRAFT", () => {
    expectInvariant(
      () =>
        assertPromoteQuoteLocalPacketIntoExistingPreconditions({
          ...baseValid,
          targetHasExistingDraft: true,
        }),
      "QUOTE_LOCAL_PACKET_PROMOTION_INTO_EXISTING_TARGET_HAS_DRAFT",
    );
  });

  it("checks ALREADY_PROMOTED before SOURCE_HAS_NO_ITEMS (lifecycle wins over content)", () => {
    expectInvariant(
      () =>
        assertPromoteQuoteLocalPacketIntoExistingPreconditions({
          ...baseValid,
          sourcePromotionStatus: "COMPLETED",
          sourceItemCount: 0,
        }),
      "QUOTE_LOCAL_PACKET_PROMOTION_INTO_EXISTING_ALREADY_PROMOTED",
    );
  });

  it("checks SOURCE_HAS_NO_ITEMS before TARGET_HAS_DRAFT (source state wins over target state)", () => {
    expectInvariant(
      () =>
        assertPromoteQuoteLocalPacketIntoExistingPreconditions({
          ...baseValid,
          sourceItemCount: 0,
          targetHasExistingDraft: true,
        }),
      "QUOTE_LOCAL_PACKET_PROMOTION_INTO_EXISTING_SOURCE_HAS_NO_ITEMS",
    );
  });

  it("includes the source + target ids in the error context for ALREADY_PROMOTED", () => {
    try {
      assertPromoteQuoteLocalPacketIntoExistingPreconditions({
        ...baseValid,
        sourcePromotionStatus: "COMPLETED",
      });
    } catch (e) {
      expect(e).toBeInstanceOf(InvariantViolationError);
      if (e instanceof InvariantViolationError) {
        expect(e.context).toMatchObject({
          quoteLocalPacketId: "qlp_1",
          targetScopePacketId: "sp_1",
          sourcePromotionStatus: "COMPLETED",
        });
      }
    }
  });

  it("includes the source + target ids in the error context for TARGET_HAS_DRAFT", () => {
    try {
      assertPromoteQuoteLocalPacketIntoExistingPreconditions({
        ...baseValid,
        targetHasExistingDraft: true,
      });
    } catch (e) {
      expect(e).toBeInstanceOf(InvariantViolationError);
      if (e instanceof InvariantViolationError) {
        expect(e.context).toMatchObject({
          quoteLocalPacketId: "qlp_1",
          targetScopePacketId: "sp_1",
        });
      }
    }
  });
});
