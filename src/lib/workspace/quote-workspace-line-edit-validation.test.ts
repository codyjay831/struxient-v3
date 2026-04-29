import { describe, expect, it } from "vitest";
import { workspaceUnitPriceDollarsSnapshotFromLine } from "./quote-workspace-line-unit-price";
import { validateWorkspaceLineEditFields } from "./quote-workspace-line-edit-validation";

describe("validateWorkspaceLineEditFields", () => {
  it("accepts valid commercial fields with computed line total", () => {
    const r = validateWorkspaceLineEditFields({
      title: "  Roof  ",
      quantity: "2",
      description: "",
      unitPriceDollars: "50.25",
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
      unitPriceDollars: "",
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
      unitPriceDollars: "",
    });
    expect(r.ok).toBe(false);
  });

  it("allows null line total when unit price blank", () => {
    const r = validateWorkspaceLineEditFields({
      title: "Line",
      quantity: "1",
      description: "note",
      unitPriceDollars: "  ",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lineTotalCents).toBe(null);
    expect(r.description).toBe("note");
  });

  it("rejects negative unit price", () => {
    const r = validateWorkspaceLineEditFields({
      title: "Line",
      quantity: "1",
      description: "",
      unitPriceDollars: "-1",
    });
    expect(r.ok).toBe(false);
  });

  it("PATCH intent: sends computed lineTotalCents from unit × quantity", () => {
    const r = validateWorkspaceLineEditFields({
      title: "L",
      quantity: "3",
      description: "",
      unitPriceDollars: "10",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lineTotalCents).toBe(3000);
  });

  it("preserves baseline lineTotalCents on no-op when quantity and unit match snapshot", () => {
    const baselineCents = 100;
    const baselineQty = 3;
    const snap = workspaceUnitPriceDollarsSnapshotFromLine(baselineCents, baselineQty);
    expect(snap).toBeTruthy();

    const r = validateWorkspaceLineEditFields(
      {
        title: "T",
        quantity: String(baselineQty),
        description: "",
        unitPriceDollars: snap,
      },
      {
        baselineLineTotalCents: baselineCents,
        baselineQuantity: baselineQty,
        initialUnitPriceDollarsSnapshot: snap,
      },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lineTotalCents).toBe(100);
  });

  it("recalculates when quantity changes away from baseline", () => {
    const snap = workspaceUnitPriceDollarsSnapshotFromLine(100, 3);
    const r = validateWorkspaceLineEditFields(
      {
        title: "T",
        quantity: "2",
        description: "",
        unitPriceDollars: snap,
      },
      {
        baselineLineTotalCents: 100,
        baselineQuantity: 3,
        initialUnitPriceDollarsSnapshot: snap,
      },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const unitCents = Math.round(Number.parseFloat(snap) * 100);
    expect(r.lineTotalCents).toBe(unitCents * 2);
  });

  it("recalculates when unit price string changes", () => {
    const snap = workspaceUnitPriceDollarsSnapshotFromLine(100, 3);
    const r = validateWorkspaceLineEditFields(
      {
        title: "T",
        quantity: "3",
        description: "",
        unitPriceDollars: "1",
      },
      {
        baselineLineTotalCents: 100,
        baselineQuantity: 3,
        initialUnitPriceDollarsSnapshot: snap,
      },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lineTotalCents).toBe(300);
  });
});
