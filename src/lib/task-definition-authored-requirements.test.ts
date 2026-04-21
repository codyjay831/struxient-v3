import { describe, expect, it } from "vitest";
import {
  COMPLETION_REQUIREMENT_KINDS,
  parseCompletionRequirements,
  type CompletionRequirement,
} from "./task-definition-authored-requirements";

describe("parseCompletionRequirements", () => {
  it("treats null/undefined as empty array", () => {
    expect(parseCompletionRequirements(null)).toEqual({ ok: true, value: [] });
    expect(parseCompletionRequirements(undefined)).toEqual({ ok: true, value: [] });
  });

  it("rejects non-array root values", () => {
    const r = parseCompletionRequirements({});
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0].message).toMatch(/array/);
    }
  });

  it("accepts the full set of authored kinds with the canonical shape", () => {
    const raw = [
      { kind: "checklist", label: "Power off", required: true },
      { kind: "measurement", label: "Suction", unit: "psi", required: true },
      { kind: "identifier", label: "Serial #", required: false },
      { kind: "result", required: true },
      { kind: "note", required: true },
      { kind: "attachment", required: true },
    ];
    const r = parseCompletionRequirements(raw);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toHaveLength(6);
    expect(r.value.map((x) => x.kind).sort()).toEqual(
      [...COMPLETION_REQUIREMENT_KINDS].sort(),
    );
  });

  it("normalizes labels (trimmed) and drops empty units", () => {
    const r = parseCompletionRequirements([
      { kind: "checklist", label: "  Lock out  ", required: true },
      { kind: "measurement", label: "Pressure", unit: "  ", required: false },
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const c = r.value[0] as Extract<CompletionRequirement, { kind: "checklist" }>;
    const m = r.value[1] as Extract<CompletionRequirement, { kind: "measurement" }>;
    expect(c.label).toBe("Lock out");
    expect(m.label).toBe("Pressure");
    expect(m.unit).toBeUndefined();
  });

  it("defaults required to false when omitted", () => {
    const r = parseCompletionRequirements([{ kind: "checklist", label: "X" }]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value[0].required).toBe(false);
  });

  it("rejects unknown kinds", () => {
    const r = parseCompletionRequirements([{ kind: "freeform", label: "X" }]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0].message).toMatch(/kind must be one of/);
  });

  it("rejects empty / missing labels for label-bearing kinds", () => {
    const r = parseCompletionRequirements([
      { kind: "checklist", label: "   ", required: true },
      { kind: "identifier" },
      { kind: "measurement", label: "" },
    ]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors).toHaveLength(3);
    expect(r.errors.every((e) => /non-empty "label"/.test(e.message))).toBe(true);
  });

  it("rejects duplicate labels within the same kind", () => {
    const r = parseCompletionRequirements([
      { kind: "checklist", label: "Lock out", required: true },
      { kind: "checklist", label: "Lock out", required: true },
    ]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0].message).toMatch(/duplicated/);
  });

  it("allows the same label across different kinds", () => {
    const r = parseCompletionRequirements([
      { kind: "checklist", label: "Voltage", required: true },
      { kind: "measurement", label: "Voltage", unit: "V", required: true },
    ]);
    expect(r.ok).toBe(true);
  });

  it("rejects multiple result/note/attachment singletons", () => {
    for (const kind of ["result", "note", "attachment"] as const) {
      const r = parseCompletionRequirements([
        { kind, required: true },
        { kind, required: false },
      ]);
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.errors[0].message).toMatch(new RegExp(`Only one "${kind}"`));
    }
  });

  it("rejects non-string measurement units", () => {
    const r = parseCompletionRequirements([
      { kind: "measurement", label: "Suction", unit: 7, required: true },
    ]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0].message).toMatch(/unit must be a string/);
  });

  it("rejects items that are not objects", () => {
    const r = parseCompletionRequirements([null, "checklist"]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors).toHaveLength(2);
    expect(r.errors.every((e) => /must be an object/.test(e.message))).toBe(true);
  });

  it("is idempotent: parse(parse(x).value) === parse(x).value", () => {
    const raw = [
      { kind: "checklist", label: "Power off", required: true },
      { kind: "measurement", label: "Pressure", unit: "psi", required: false },
      { kind: "result", required: true },
    ];
    const a = parseCompletionRequirements(raw);
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    const b = parseCompletionRequirements(a.value);
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    expect(b.value).toEqual(a.value);
  });

  it("caps the number of requirements", () => {
    const big = Array.from({ length: 51 }, (_, i) => ({
      kind: "checklist" as const,
      label: `c${i}`,
      required: false,
    }));
    const r = parseCompletionRequirements(big);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0].message).toMatch(/at most 50/);
  });
});
