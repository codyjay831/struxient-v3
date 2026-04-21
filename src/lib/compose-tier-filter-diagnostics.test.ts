import { describe, expect, it } from "vitest";
import {
  summarizeTierPartialExclusion,
  type TierFilterDiagnosticsItem,
} from "./compose-tier-filter-diagnostics";

function items(tiers: Array<string | null>): TierFilterDiagnosticsItem[] {
  return tiers.map((tierCode) => ({ tierCode }));
}

describe("summarizeTierPartialExclusion", () => {
  it("returns null when no candidates", () => {
    expect(summarizeTierPartialExclusion({ candidates: [], filtered: [] })).toBeNull();
  });

  it("returns null when nothing was excluded (filtered === candidates)", () => {
    const candidates = items(["GOOD", "BETTER", null]);
    const filtered = candidates;
    expect(summarizeTierPartialExclusion({ candidates, filtered })).toBeNull();
  });

  it("returns null when everything was excluded (covered by EXPANSION_EMPTY)", () => {
    const candidates = items(["GOOD", "BETTER"]);
    const filtered: TierFilterDiagnosticsItem[] = [];
    expect(summarizeTierPartialExclusion({ candidates, filtered })).toBeNull();
  });

  it("returns counts and distinct sorted sample tier codes for partial exclusion", () => {
    const candidates = items(["GOOD", "BETTER", "BEST", "GOOD"]);
    const filtered = [candidates[0]!, candidates[3]!];
    const summary = summarizeTierPartialExclusion({ candidates, filtered });
    expect(summary).toEqual({
      includedCount: 2,
      excludedCount: 2,
      sampleExcludedTierCodes: ["BEST", "BETTER"],
    });
  });

  it("excludes blank tier codes from the sample (blank means applies-to-all)", () => {
    const candidates = items(["GOOD", "", null, "BETTER"]);
    const filtered = [candidates[0]!];
    const summary = summarizeTierPartialExclusion({ candidates, filtered });
    expect(summary).toEqual({
      includedCount: 1,
      excludedCount: 3,
      sampleExcludedTierCodes: ["BETTER"],
    });
  });

  it("caps sampleExcludedTierCodes at 5 distinct codes", () => {
    const candidates = items([
      "T1",
      "T2",
      "T3",
      "T4",
      "T5",
      "T6",
      "T7",
      "INCLUDED",
    ]);
    const filtered = [candidates[7]!];
    const summary = summarizeTierPartialExclusion({ candidates, filtered });
    expect(summary?.includedCount).toBe(1);
    expect(summary?.excludedCount).toBe(7);
    expect(summary?.sampleExcludedTierCodes).toEqual(["T1", "T2", "T3", "T4", "T5"]);
  });

  it("treats case-different tier codes as distinct (matches engine exact-match semantics)", () => {
    const candidates = items(["good", "GOOD", "Good"]);
    const filtered = [candidates[1]!];
    const summary = summarizeTierPartialExclusion({ candidates, filtered });
    expect(summary?.includedCount).toBe(1);
    expect(summary?.excludedCount).toBe(2);
    expect(summary?.sampleExcludedTierCodes).toEqual(["Good", "good"]);
  });
});
