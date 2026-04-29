import { describe, expect, it } from "vitest";
import { validateWorkspaceLineEditFields } from "./quote-workspace-line-edit-validation";

describe("validateWorkspaceLineEditFields", () => {
  it("accepts valid commercial fields", () => {
    const r = validateWorkspaceLineEditFields({
      title: "  Roof  ",
      quantity: "2",
      description: "",
      lineTotalDollars: "100.50",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.title).toBe("Roof");
    expect(r.quantity).toBe(2);
    expect(r.description).toBe(null);
    expect(r.lineTotalCents).toBe(10050);
  });

  it("rejects empty title", () => {
    const r = validateWorkspaceLineEditFields({
      title: "   ",
      quantity: "1",
      description: "",
      lineTotalDollars: "",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.message).toContain("Title");
  });

  it("rejects quantity below 1", () => {
    const r = validateWorkspaceLineEditFields({
      title: "A",
      quantity: "0",
      description: "",
      lineTotalDollars: "",
    });
    expect(r.ok).toBe(false);
  });

  it("allows null line total when dollars blank", () => {
    const r = validateWorkspaceLineEditFields({
      title: "Line",
      quantity: "1",
      description: "note",
      lineTotalDollars: "  ",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lineTotalCents).toBe(null);
    expect(r.description).toBe("note");
  });

  it("rejects negative dollars", () => {
    const r = validateWorkspaceLineEditFields({
      title: "Line",
      quantity: "1",
      description: "",
      lineTotalDollars: "-1",
    });
    expect(r.ok).toBe(false);
  });
});
