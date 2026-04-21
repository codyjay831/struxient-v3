import { describe, expect, it } from "vitest";
import { isBaselineRequired } from "./runtime-task-required-helpers";

describe("isBaselineRequired", () => {
  it("returns false for null / undefined / non-array snapshots", () => {
    expect(isBaselineRequired(null, "note")).toBe(false);
    expect(isBaselineRequired(undefined, "note")).toBe(false);
    expect(isBaselineRequired({}, "note")).toBe(false);
    expect(isBaselineRequired("[]", "note")).toBe(false);
  });

  it("returns true for a baseline required note", () => {
    const snap = [
      { kind: "checklist", label: "Power off", required: true },
      { kind: "note", required: true },
    ];
    expect(isBaselineRequired(snap, "note")).toBe(true);
  });

  it("returns true for a baseline required attachment", () => {
    const snap = [
      { kind: "result", required: true },
      { kind: "attachment", required: true },
    ];
    expect(isBaselineRequired(snap, "attachment")).toBe(true);
  });

  it("returns false when the matching kind is present but not required", () => {
    expect(
      isBaselineRequired([{ kind: "note", required: false }], "note"),
    ).toBe(false);
    expect(
      isBaselineRequired([{ kind: "attachment", required: false }], "attachment"),
    ).toBe(false);
  });

  it("returns false when no item of that kind is present", () => {
    const snap = [
      { kind: "checklist", label: "Power off", required: true },
      { kind: "measurement", label: "Suction", required: true },
    ];
    expect(isBaselineRequired(snap, "note")).toBe(false);
    expect(isBaselineRequired(snap, "attachment")).toBe(false);
  });

  it("ignores malformed items without throwing", () => {
    const snap = [
      null,
      "not-an-object",
      42,
      { kind: "note" /* required omitted */ },
      { kind: "note", required: "yes" /* wrong type */ },
      { kind: "note", required: true },
    ];
    expect(isBaselineRequired(snap, "note")).toBe(true);
  });

  it("does not coerce truthy values for `required` (must be strict true)", () => {
    expect(
      isBaselineRequired([{ kind: "note", required: 1 }], "note"),
    ).toBe(false);
    expect(
      isBaselineRequired([{ kind: "attachment", required: "true" }], "attachment"),
    ).toBe(false);
  });

  it("supports the result singleton too (parity with note/attachment)", () => {
    expect(
      isBaselineRequired([{ kind: "result", required: true }], "result"),
    ).toBe(true);
    expect(
      isBaselineRequired([{ kind: "result", required: false }], "result"),
    ).toBe(false);
  });
});
