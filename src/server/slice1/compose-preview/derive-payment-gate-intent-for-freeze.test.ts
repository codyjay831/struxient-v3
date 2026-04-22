import { describe, expect, it } from "vitest";
import type { ComposePackageSlotDto } from "./compose-engine";
import { derivePaymentGateIntentForFreeze, normalizePaymentGateTitleOverride } from "./derive-payment-gate-intent-for-freeze";

function slot(lineItemId: string, packageTaskId: string): ComposePackageSlotDto {
  return {
    packageTaskId,
    nodeId: "n1",
    source: "SOLD_SCOPE",
    planTaskIds: ["p1"],
    skeletonTaskId: null,
    displayTitle: "t",
    lineItemId,
  };
}

describe("normalizePaymentGateTitleOverride", () => {
  it("trims and caps length", () => {
    expect(normalizePaymentGateTitleOverride("  hi  ")).toBe("hi");
    expect(normalizePaymentGateTitleOverride("")).toBe(null);
    expect(normalizePaymentGateTitleOverride(null)).toBe(null);
    const long = "x".repeat(200);
    expect(normalizePaymentGateTitleOverride(long)!.length).toBe(120);
  });
});

describe("derivePaymentGateIntentForFreeze", () => {
  it("returns null when no lines are flagged", () => {
    const r = derivePaymentGateIntentForFreeze({
      orderedLineItems: [
        { id: "a", title: "A", paymentBeforeWork: false, paymentGateTitleOverride: null },
      ],
      packageSlots: [slot("a", "pkg-1")],
    });
    expect(r).toEqual({ ok: true, intent: null });
  });

  it("collects sorted unique packageTaskIds for flagged lines", () => {
    const r = derivePaymentGateIntentForFreeze({
      orderedLineItems: [
        { id: "b", title: "B", paymentBeforeWork: false, paymentGateTitleOverride: null },
        { id: "a", title: "Line A", paymentBeforeWork: true, paymentGateTitleOverride: null },
      ],
      packageSlots: [slot("a", "z-task"), slot("a", "a-task"), slot("a", "a-task")],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.intent).toMatchObject({
      schemaVersion: "paymentGateIntent.v0",
      title: "Payment before work — Line A",
      targetPackageTaskIds: ["a-task", "z-task"],
    });
  });

  it("uses first override in scope order for title", () => {
    const r = derivePaymentGateIntentForFreeze({
      orderedLineItems: [
        { id: "x", title: "X", paymentBeforeWork: true, paymentGateTitleOverride: "Second" },
        { id: "y", title: "Y", paymentBeforeWork: true, paymentGateTitleOverride: "First override" },
      ],
      packageSlots: [slot("x", "p1"), slot("y", "p2")],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.intent?.title).toBe("Second");
    expect(r.intent?.targetPackageTaskIds).toEqual(["p1", "p2"]);
  });

  it("fails when a flagged line has no package slots", () => {
    const r = derivePaymentGateIntentForFreeze({
      orderedLineItems: [{ id: "lonely", title: "L", paymentBeforeWork: true, paymentGateTitleOverride: null }],
      packageSlots: [slot("other", "p9")],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0]?.code).toBe("PAYMENT_GATE_NO_PACKAGE_TASKS");
    expect(r.errors[0]?.lineItemId).toBe("lonely");
  });
});
