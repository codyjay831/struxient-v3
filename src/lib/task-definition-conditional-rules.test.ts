import { describe, expect, it } from "vitest";
import {
  buildRequirementsContext,
  parseConditionalRules,
  type ConditionalRule,
} from "./task-definition-conditional-rules";
import type { CompletionRequirement } from "./task-definition-authored-requirements";

const REQS: CompletionRequirement[] = [
  { kind: "checklist", label: "Power off", required: true },
  { kind: "measurement", label: "Suction", unit: "psi", required: true },
  { kind: "identifier", label: "Serial #", required: false },
  { kind: "result", required: true },
];
const CTX = buildRequirementsContext(REQS);

describe("parseConditionalRules", () => {
  it("treats null/undefined as empty array", () => {
    expect(parseConditionalRules(null)).toEqual({ ok: true, value: [] });
    expect(parseConditionalRules(undefined)).toEqual({ ok: true, value: [] });
  });

  it("rejects non-array root values", () => {
    const r = parseConditionalRules({});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0].message).toMatch(/array/);
  });

  it("accepts a result→note rule", () => {
    const r = parseConditionalRules(
      [
        {
          trigger: { kind: "result", value: "FAIL" },
          require: { kind: "note", message: "Explain failure." },
        },
      ],
      CTX,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toHaveLength(1);
    expect(r.value[0].trigger).toEqual({ kind: "result", value: "FAIL" });
    expect(r.value[0].require).toEqual({ kind: "note", message: "Explain failure." });
    expect(r.value[0].id).toBe("rule-1");
  });

  it("accepts a checklist→attachment rule with cross-validated label", () => {
    const r = parseConditionalRules(
      [
        {
          trigger: { kind: "checklist", label: "Power off", value: "no" },
          require: { kind: "attachment" },
        },
      ],
      CTX,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value[0].trigger).toEqual({
      kind: "checklist",
      label: "Power off",
      value: "no",
    });
    expect(r.value[0].require).toEqual({ kind: "attachment" });
  });

  it("rejects an unknown checklist trigger label when context is provided", () => {
    const r = parseConditionalRules(
      [
        {
          trigger: { kind: "checklist", label: "Made up", value: "no" },
          require: { kind: "note" },
        },
      ],
      CTX,
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0].message).toMatch(/does not match any authored checklist/);
  });

  it("rejects an unknown measurement require label when context is provided", () => {
    const r = parseConditionalRules(
      [
        {
          trigger: { kind: "result", value: "FAIL" },
          require: { kind: "measurement", label: "Bogus" },
        },
      ],
      CTX,
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0].message).toMatch(/measurement require\.label "Bogus"/);
  });

  it("skips label cross-checks when context is null (defensive read)", () => {
    const r = parseConditionalRules(
      [
        {
          trigger: { kind: "checklist", label: "Anything", value: "no" },
          require: { kind: "measurement", label: "Anything" },
        },
      ],
      null,
    );
    expect(r.ok).toBe(true);
  });

  it("rejects unsupported result trigger values", () => {
    const r = parseConditionalRules(
      [{ trigger: { kind: "result", value: "MAYBE" }, require: { kind: "note" } }],
      CTX,
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0].message).toMatch(/result trigger\.value/);
  });

  it("rejects unsupported checklist trigger values", () => {
    const r = parseConditionalRules(
      [
        {
          trigger: { kind: "checklist", label: "Power off", value: "skip" },
          require: { kind: "note" },
        },
      ],
      CTX,
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0].message).toMatch(/checklist trigger\.value/);
  });

  it("rejects unknown trigger or require kinds", () => {
    const r1 = parseConditionalRules(
      [{ trigger: { kind: "weird", value: "X" }, require: { kind: "note" } }],
      CTX,
    );
    expect(r1.ok).toBe(false);
    const r2 = parseConditionalRules(
      [
        {
          trigger: { kind: "result", value: "FAIL" },
          require: { kind: "signature" },
        },
      ],
      CTX,
    );
    expect(r2.ok).toBe(false);
  });

  it("rejects identical (trigger, require) duplicates", () => {
    const r = parseConditionalRules(
      [
        {
          id: "a",
          trigger: { kind: "result", value: "FAIL" },
          require: { kind: "note" },
        },
        {
          id: "b",
          trigger: { kind: "result", value: "FAIL" },
          require: { kind: "note" },
        },
      ],
      CTX,
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0].message).toMatch(/same trigger and require/);
  });

  it("rejects duplicate rule ids", () => {
    const r = parseConditionalRules(
      [
        {
          id: "same",
          trigger: { kind: "result", value: "FAIL" },
          require: { kind: "note" },
        },
        {
          id: "same",
          trigger: { kind: "result", value: "INCOMPLETE" },
          require: { kind: "note" },
        },
      ],
      CTX,
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0].message).toMatch(/Duplicate rule id "same"/);
  });

  it("auto-assigns ids when missing and preserves caller-supplied ids when valid", () => {
    const r = parseConditionalRules(
      [
        { trigger: { kind: "result", value: "FAIL" }, require: { kind: "note" } },
        {
          id: "custom-id",
          trigger: { kind: "result", value: "INCOMPLETE" },
          require: { kind: "attachment" },
        },
      ],
      CTX,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value[0].id).toBe("rule-1");
    expect(r.value[1].id).toBe("custom-id");
  });

  it("strips empty messages and rejects non-string messages", () => {
    const r = parseConditionalRules(
      [
        {
          trigger: { kind: "result", value: "FAIL" },
          require: { kind: "note", message: "   " },
        },
      ],
      CTX,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect((r.value[0].require as { message?: string }).message).toBeUndefined();

    const r2 = parseConditionalRules(
      [
        {
          trigger: { kind: "result", value: "FAIL" },
          require: { kind: "note", message: 7 },
        },
      ],
      CTX,
    );
    expect(r2.ok).toBe(false);
  });

  it("caps the number of rules", () => {
    const big: ConditionalRule[] = Array.from({ length: 26 }, (_, i) => ({
      id: `r${i}`,
      trigger: { kind: "result", value: "FAIL" },
      require: { kind: "note" },
    }));
    const r = parseConditionalRules(big, CTX);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0].message).toMatch(/at most 25/);
  });

  it("is idempotent: parse(parse(x).value) === parse(x).value", () => {
    const raw = [
      {
        trigger: { kind: "result", value: "FAIL" },
        require: { kind: "attachment" },
      },
      {
        trigger: { kind: "checklist", label: "Power off", value: "no" },
        require: { kind: "measurement", label: "Suction", message: "Re-measure." },
      },
    ];
    const a = parseConditionalRules(raw, CTX);
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    const b = parseConditionalRules(a.value, CTX);
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    expect(b.value).toEqual(a.value);
  });
});
