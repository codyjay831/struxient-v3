import { describe, expect, it } from "vitest";
import { manualLeadStatusTargets, officeLeadConvertAllowed } from "./lead-status-ui";

describe("manualLeadStatusTargets", () => {
  it("OPEN lead can move to other pipeline states or terminal outcomes", () => {
    expect(new Set(manualLeadStatusTargets("OPEN"))).toEqual(
      new Set(["ON_HOLD", "NURTURE", "LOST", "ARCHIVED"]),
    );
  });

  it("terminal manual statuses offer no further transitions", () => {
    expect(manualLeadStatusTargets("LOST")).toEqual([]);
    expect(manualLeadStatusTargets("ARCHIVED")).toEqual([]);
  });

  it("CONVERTED is not a manual status target", () => {
    expect(manualLeadStatusTargets("CONVERTED")).toEqual([]);
  });
});

describe("officeLeadConvertAllowed", () => {
  it("requires OPEN and office_mutate", () => {
    expect(officeLeadConvertAllowed("OPEN", true)).toBe(true);
    expect(officeLeadConvertAllowed("OPEN", false)).toBe(false);
    expect(officeLeadConvertAllowed("ON_HOLD", true)).toBe(false);
    expect(officeLeadConvertAllowed("CONVERTED", true)).toBe(false);
  });
});
