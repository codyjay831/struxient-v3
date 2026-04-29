import { describe, expect, it } from "vitest";
import {
  buildSoldScopeLineItemCreateRequestBody,
  validateWorkspaceLineCreateFields,
} from "./quote-workspace-line-create-validation";

describe("validateWorkspaceLineCreateFields", () => {
  const base = (over: Partial<Record<string, string>> = {}) => ({
    title: "Roof repair",
    quantity: "1",
    description: "",
    unitPriceDollars: "",
    ...over,
  });

  it("requires trimmed title", () => {
    const a = validateWorkspaceLineCreateFields(base({ title: "   " }));
    expect(a.ok).toBe(false);
    if (!a.ok) expect(a.errors.title).toMatch(/required/i);
  });

  it("requires quantity when blank", () => {
    const r = validateWorkspaceLineCreateFields(base({ quantity: "   " }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.quantity).toMatch(/required/i);
  });

  it("requires quantity >= 1", () => {
    const zero = validateWorkspaceLineCreateFields(base({ quantity: "0" }));
    expect(zero.ok).toBe(false);
    if (!zero.ok) expect(zero.errors.quantity).toMatch(/at least 1/);

    const neg = validateWorkspaceLineCreateFields(base({ quantity: "-2" }));
    expect(neg.ok).toBe(false);
    if (!neg.ok) expect(neg.errors.quantity).toBeDefined();
  });

  it("rejects non-integer quantity", () => {
    const r = validateWorkspaceLineCreateFields(base({ quantity: "1.5" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.quantity).toMatch(/whole number/);
  });

  it("trims description and returns null when empty", () => {
    const r = validateWorkspaceLineCreateFields(base({ description: "  \n  " }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.description).toBe(null);
  });

  it("keeps non-empty trimmed description", () => {
    const r = validateWorkspaceLineCreateFields(base({ description: "  Notes here  " }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.description).toBe("Notes here");
  });

  it("allows null line total when unit price blank", () => {
    const r = validateWorkspaceLineCreateFields(base({ unitPriceDollars: "  " }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.lineTotalCents).toBe(null);
  });

  it("parses unit price dollars to cents and multiplies by quantity for lineTotalCents", () => {
    const r = validateWorkspaceLineCreateFields(
      base({ unitPriceDollars: "12.34", quantity: "2" }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.lineTotalCents).toBe(2468);
  });

  it("uses half-up rounding for per-unit cents before multiplying", () => {
    const r = validateWorkspaceLineCreateFields(
      base({ unitPriceDollars: "0.125", quantity: "2" }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.lineTotalCents).toBe(26);
  });

  it("rejects negative unit price", () => {
    const r = validateWorkspaceLineCreateFields(base({ unitPriceDollars: "-1" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.unitPrice).toMatch(/non-negative/i);
  });

  it("rejects invalid unit price string", () => {
    const r = validateWorkspaceLineCreateFields(base({ unitPriceDollars: "x" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.unitPrice).toBeDefined();
  });
});

describe("buildSoldScopeLineItemCreateRequestBody", () => {
  it("matches workspace SOLD_SCOPE create intent (null pins, unitPriceCents null)", () => {
    const body = buildSoldScopeLineItemCreateRequestBody({
      proposalGroupId: "pg_1",
      sortOrder: 3,
      value: {
        title: "Line A",
        description: null,
        quantity: 2,
        lineTotalCents: 500,
      },
    });
    expect(body).toEqual({
      proposalGroupId: "pg_1",
      sortOrder: 3,
      executionMode: "SOLD_SCOPE",
      title: "Line A",
      description: null,
      quantity: 2,
      tierCode: null,
      scopePacketRevisionId: null,
      quoteLocalPacketId: null,
      unitPriceCents: null,
      lineTotalCents: 500,
      paymentBeforeWork: false,
      paymentGateTitleOverride: null,
    });
  });
});
