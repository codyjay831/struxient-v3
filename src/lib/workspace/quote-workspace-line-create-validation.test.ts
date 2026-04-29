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
    lineTotalDollars: "",
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

  it("parses optional line total dollars to cents", () => {
    const r = validateWorkspaceLineCreateFields(base({ lineTotalDollars: "12.34" }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.lineTotalCents).toBe(1234);
  });

  it("allows null line total when blank", () => {
    const r = validateWorkspaceLineCreateFields(base({ lineTotalDollars: "  " }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.lineTotalCents).toBe(null);
  });
});

describe("buildSoldScopeLineItemCreateRequestBody", () => {
  it("matches workspace SOLD_SCOPE create intent (null pins, no manifest)", () => {
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
