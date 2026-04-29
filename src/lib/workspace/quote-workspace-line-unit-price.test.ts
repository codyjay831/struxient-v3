import { describe, expect, it } from "vitest";
import {
  workspaceComputedLineTotalKind,
  workspaceUnitPriceDollarsSnapshotFromLine,
} from "./quote-workspace-line-unit-price";

describe("workspaceUnitPriceDollarsSnapshotFromLine", () => {
  it("returns empty when no line total", () => {
    expect(workspaceUnitPriceDollarsSnapshotFromLine(null, 2)).toBe("");
  });

  it("returns per-unit dollars for even division", () => {
    expect(workspaceUnitPriceDollarsSnapshotFromLine(1000, 2)).toBe("5");
  });
});

describe("workspaceComputedLineTotalKind", () => {
  it("returns no_amount when unit price blank", () => {
    expect(workspaceComputedLineTotalKind("", "3")).toEqual({ kind: "no_amount" });
    expect(workspaceComputedLineTotalKind("  ", "3")).toEqual({ kind: "no_amount" });
  });

  it("returns amount when unit and quantity valid", () => {
    expect(workspaceComputedLineTotalKind("10", "2")).toEqual({ kind: "amount", cents: 2000 });
  });
});
