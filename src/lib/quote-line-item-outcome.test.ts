import { describe, expect, it } from "vitest";

import {
  deriveQuoteLineItemOutcome,
  deriveQuoteLineItemOutcomeBreakdown,
  formatQuoteLineItemOutcomeLabel,
} from "./quote-line-item-outcome";

describe("deriveQuoteLineItemOutcome", () => {
  it("returns field_work_saved when library-backed", () => {
    expect(
      deriveQuoteLineItemOutcome({ isLibraryBacked: true, isQuoteLocal: false }),
    ).toBe("field_work_saved");
  });

  it("returns field_work_one_off when quote-local", () => {
    expect(
      deriveQuoteLineItemOutcome({ isLibraryBacked: false, isQuoteLocal: true }),
    ).toBe("field_work_one_off");
  });

  it("returns quote_only when no packet attached", () => {
    expect(
      deriveQuoteLineItemOutcome({ isLibraryBacked: false, isQuoteLocal: false }),
    ).toBe("quote_only");
  });

  it("prefers library-backed if both flags are set (defensive; invariant should prevent this)", () => {
    expect(
      deriveQuoteLineItemOutcome({ isLibraryBacked: true, isQuoteLocal: true }),
    ).toBe("field_work_saved");
  });
});

describe("formatQuoteLineItemOutcomeLabel", () => {
  it("maps each outcome to a contractor-friendly label", () => {
    expect(formatQuoteLineItemOutcomeLabel("quote_only")).toBe("Quote-only");
    expect(formatQuoteLineItemOutcomeLabel("field_work_saved")).toBe(
      "Field work — saved",
    );
    expect(formatQuoteLineItemOutcomeLabel("field_work_one_off")).toBe(
      "Field work — one-off",
    );
  });
});

describe("deriveQuoteLineItemOutcomeBreakdown", () => {
  it("derives quote-only and field-work counts from summary numbers", () => {
    expect(
      deriveQuoteLineItemOutcomeBreakdown({
        lineItemCount: 5,
        libraryLineItemCount: 2,
        localLineItemCount: 1,
      }),
    ).toEqual({
      total: 5,
      quoteOnly: 2,
      fieldWork: 3,
      fieldWorkSaved: 2,
      fieldWorkOneOff: 1,
    });
  });

  it("returns zero quote-only when all lines are field work", () => {
    expect(
      deriveQuoteLineItemOutcomeBreakdown({
        lineItemCount: 3,
        libraryLineItemCount: 1,
        localLineItemCount: 2,
      }),
    ).toEqual({
      total: 3,
      quoteOnly: 0,
      fieldWork: 3,
      fieldWorkSaved: 1,
      fieldWorkOneOff: 2,
    });
  });

  it("returns all quote-only when no packets attached", () => {
    expect(
      deriveQuoteLineItemOutcomeBreakdown({
        lineItemCount: 4,
        libraryLineItemCount: 0,
        localLineItemCount: 0,
      }),
    ).toEqual({
      total: 4,
      quoteOnly: 4,
      fieldWork: 0,
      fieldWorkSaved: 0,
      fieldWorkOneOff: 0,
    });
  });

  it("clamps quote-only to zero if counts disagree (defensive)", () => {
    expect(
      deriveQuoteLineItemOutcomeBreakdown({
        lineItemCount: 1,
        libraryLineItemCount: 2,
        localLineItemCount: 1,
      }),
    ).toEqual({
      total: 1,
      quoteOnly: 0,
      fieldWork: 3,
      fieldWorkSaved: 2,
      fieldWorkOneOff: 1,
    });
  });

  it("handles empty quote", () => {
    expect(
      deriveQuoteLineItemOutcomeBreakdown({
        lineItemCount: 0,
        libraryLineItemCount: 0,
        localLineItemCount: 0,
      }),
    ).toEqual({
      total: 0,
      quoteOnly: 0,
      fieldWork: 0,
      fieldWorkSaved: 0,
      fieldWorkOneOff: 0,
    });
  });
});
