import { describe, expect, it } from "vitest";
import { shouldShowPortalDeclineVoidExplanation } from "./quote-workspace-reads";

describe("shouldShowPortalDeclineVoidExplanation", () => {
  it("is true only for VOID change order with DECLINED linked draft", () => {
    expect(
      shouldShowPortalDeclineVoidExplanation({ status: "VOID", draftQuoteVersionStatus: "DECLINED" }),
    ).toBe(true);
  });

  it("is false when VOID but draft is not DECLINED", () => {
    expect(
      shouldShowPortalDeclineVoidExplanation({ status: "VOID", draftQuoteVersionStatus: "SENT" }),
    ).toBe(false);
    expect(shouldShowPortalDeclineVoidExplanation({ status: "VOID", draftQuoteVersionStatus: null })).toBe(false);
  });

  it("is false when DECLINED draft but change order is not VOID", () => {
    expect(
      shouldShowPortalDeclineVoidExplanation({ status: "PENDING_CUSTOMER", draftQuoteVersionStatus: "DECLINED" }),
    ).toBe(false);
  });
});
