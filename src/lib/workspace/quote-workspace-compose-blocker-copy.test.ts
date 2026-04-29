import { describe, expect, it } from "vitest";
import {
  EXPANSION_EMPTY_QUOTE_LOCAL_MESSAGE,
  buildLineComposeBlockerBanner,
  groupComposeBlockingErrorsByLineItemId,
  mapComposeLineBlockingIssueToBanner,
  sortComposeBlockingIssuesForLine,
} from "./quote-workspace-compose-blocker-copy";

describe("mapComposeLineBlockingIssueToBanner", () => {
  it("maps EXPANSION_EMPTY quote-local message to contractor copy and preserves technical fields", () => {
    const b = mapComposeLineBlockingIssueToBanner("q1", "line-a", {
      code: "EXPANSION_EMPTY",
      message: EXPANSION_EMPTY_QUOTE_LOCAL_MESSAGE,
      lineItemId: "line-a",
    });
    expect(b.contractorTitle).toBe("Line needs crew tasks");
    expect(b.contractorBody).toContain("no crew tasks for the selected tier");
    expect(b.technicalCode).toBe("EXPANSION_EMPTY");
    expect(b.technicalMessage).toBe(EXPANSION_EMPTY_QUOTE_LOCAL_MESSAGE);
    expect(b.actionLabel).toBe("Jump to line");
    expect(b.actionHref).toBe("/quotes/q1#line-item-line-a");
    expect(b.showTechnicalDetails).toBe(true);
  });

  it("maps unknown line-level codes to generic contractor copy", () => {
    const b = mapComposeLineBlockingIssueToBanner("q9", "line-x", {
      code: "PACKAGE_BIND_FAILED",
      message: 'targetNodeKey "x" is not present on pinned workflow snapshot nodes.',
      lineItemId: "line-x",
    });
    expect(b.contractorTitle).toBe("Line needs attention");
    expect(b.contractorBody).toContain("blocking the proposal");
    expect(b.technicalCode).toBe("PACKAGE_BIND_FAILED");
    expect(b.technicalMessage).toContain("targetNodeKey");
  });
});

describe("groupComposeBlockingErrorsByLineItemId", () => {
  it("groups only errors with lineItemId", () => {
    const g = groupComposeBlockingErrorsByLineItemId([
      { code: "A", message: "m1", lineItemId: "L1" },
      { code: "B", message: "m2" },
      { code: "C", message: "m3", lineItemId: "L1" },
    ]);
    expect(Object.keys(g).sort()).toEqual(["L1"]);
    expect(g.L1).toHaveLength(2);
  });
});

describe("sortComposeBlockingIssuesForLine", () => {
  it("orders EXPANSION_EMPTY quote-local before other codes", () => {
    const s = sortComposeBlockingIssuesForLine([
      { code: "OTHER", message: "x", lineItemId: "L" },
      { code: "EXPANSION_EMPTY", message: EXPANSION_EMPTY_QUOTE_LOCAL_MESSAGE, lineItemId: "L" },
    ]);
    expect(s[0]!.code).toBe("EXPANSION_EMPTY");
  });
});

describe("buildLineComposeBlockerBanner", () => {
  it("merges multiple issues and lists extras in additionalTechnical", () => {
    const b = buildLineComposeBlockerBanner("q", "L1", [
      { code: "OTHER", message: "first other", lineItemId: "L1" },
      { code: "EXPANSION_EMPTY", message: EXPANSION_EMPTY_QUOTE_LOCAL_MESSAGE, lineItemId: "L1" },
    ]);
    expect(b).not.toBeNull();
    expect(b!.contractorTitle).toBe("Line needs crew tasks");
    expect(b!.contractorBody).toContain("another issue");
    expect(b!.additionalTechnical?.length).toBe(1);
    expect(b!.additionalTechnical![0]!.code).toBe("OTHER");
  });
});
