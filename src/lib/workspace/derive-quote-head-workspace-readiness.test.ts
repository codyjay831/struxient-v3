import { describe, expect, it } from "vitest";
import { deriveQuoteHeadWorkspaceReadiness, type QuoteHeadReadinessInput } from "./derive-quote-head-workspace-readiness";

function base(over: Partial<QuoteHeadReadinessInput> = {}): QuoteHeadReadinessInput {
  return {
    id: "qv_test_0000000000000001",
    versionNumber: 1,
    status: "DRAFT",
    lineItemCount: 1,
    hasPinnedWorkflow: false,
    hasFrozenArtifacts: false,
    hasActivation: false,
    proposalGroupCount: 0,
    sentAt: null,
    signedAt: null,
    ...over,
  };
}

describe("deriveQuoteHeadWorkspaceReadiness", () => {
  it("returns no_versions when head is null", () => {
    expect(deriveQuoteHeadWorkspaceReadiness(null)).toEqual({ kind: "no_versions" });
  });

  it("draft with no line items recommends scope authoring (step 1)", () => {
    const r = deriveQuoteHeadWorkspaceReadiness(base({ status: "DRAFT", lineItemCount: 0, hasPinnedWorkflow: false }));
    expect(r.kind).toBe("head");
    if (r.kind !== "head") return;
    expect(r.recommendedStepIndex).toBe(1);
    expect(r.checklist.find((c) => c.id === "scope")?.state).toBe("no");
    expect(
      r.likelyNextSteps.some((s) => s.toLowerCase().includes("line item") || s.toLowerCase().includes("scope")),
    ).toBe(true);
  });

  it("draft with scope but no pin recommends pinning the process template (step 2)", () => {
    const r = deriveQuoteHeadWorkspaceReadiness(
      base({ status: "DRAFT", lineItemCount: 2, hasPinnedWorkflow: false }),
    );
    expect(r.kind).toBe("head");
    if (r.kind !== "head") return;
    expect(r.recommendedStepIndex).toBe(2);
    expect(r.checklist.find((c) => c.id === "scope")?.state).toBe("yes");
    const pin = r.checklist.find((c) => c.id === "pin");
    expect(pin?.state).toBe("no");
    expect(pin?.label.toLowerCase()).toContain("process template");
    expect(r.likelyNextSteps.some((s) => s.includes("PATCH"))).toBe(true);
    expect(r.honestyNotes.some((s) => s.includes("compose-preview"))).toBe(true);
  });

  it("draft with scope and pin points at compose then send (step 3)", () => {
    const r = deriveQuoteHeadWorkspaceReadiness(
      base({ status: "DRAFT", lineItemCount: 2, hasPinnedWorkflow: true }),
    );
    expect(r.kind).toBe("head");
    if (r.kind !== "head") return;
    expect(r.recommendedStepIndex).toBe(3);
    expect(r.checklist.find((c) => c.id === "pin")?.state).toBe("yes");
    expect(r.likelyNextSteps.some((s) => s.toLowerCase().includes("compose preview"))).toBe(true);
  });

  it("sent suggests sign and reads", () => {
    const r = deriveQuoteHeadWorkspaceReadiness(
      base({
        status: "SENT",
        lineItemCount: 2,
        hasPinnedWorkflow: true,
        hasFrozenArtifacts: true,
        sentAt: "2026-01-01T00:00:00.000Z",
      }),
    );
    expect(r.kind).toBe("head");
    if (r.kind !== "head") return;
    expect(r.recommendedStepIndex).toBe(4);
    expect(r.likelyNextSteps.some((s) => s.includes("/sign"))).toBe(true);
    expect(r.likelyNextSteps.some((s) => s.includes("freeze") || s.includes("lifecycle"))).toBe(true);
  });

  it("signed without activation suggests activate", () => {
    const r = deriveQuoteHeadWorkspaceReadiness(
      base({
        status: "SIGNED",
        lineItemCount: 2,
        hasPinnedWorkflow: true,
        hasFrozenArtifacts: true,
        hasActivation: false,
        signedAt: "2026-01-02T00:00:00.000Z",
      }),
    );
    expect(r.kind).toBe("head");
    if (r.kind !== "head") return;
    expect(r.recommendedStepIndex).toBe(5);
    expect(r.likelyNextSteps.some((s) => s.includes("/activate"))).toBe(true);
  });

  it("signed with activation mentions runtime", () => {
    const r = deriveQuoteHeadWorkspaceReadiness(
      base({ status: "SIGNED", lineItemCount: 2, hasPinnedWorkflow: true, hasFrozenArtifacts: true, hasActivation: true }),
    );
    expect(r.kind).toBe("head");
    if (r.kind !== "head") return;
    expect(r.recommendedStepIndex).toBeNull();
    expect(r.likelyNextSteps.some((s) => s.toLowerCase().includes("runtime"))).toBe(true);
  });

  it("honesty notes teach scope-first canon", () => {
    const r = deriveQuoteHeadWorkspaceReadiness(base({ status: "DRAFT", lineItemCount: 2, hasPinnedWorkflow: true }));
    expect(r.kind).toBe("head");
    if (r.kind !== "head") return;
    expect(
      r.honestyNotes.some(
        (s) =>
          s.toLowerCase().includes("line items") &&
          s.toLowerCase().includes("process template") &&
          s.toLowerCase().includes("skeleton"),
      ),
    ).toBe(true);
  });

  it("void head: no recommended step and void honesty note", () => {
    const r = deriveQuoteHeadWorkspaceReadiness(
      base({ status: "VOID", lineItemCount: 1, hasPinnedWorkflow: true, hasFrozenArtifacts: true }),
    );
    expect(r.kind).toBe("head");
    if (r.kind !== "head") return;
    expect(r.recommendedStepIndex).toBeNull();
    expect(r.honestyNotes.some((s) => s.toLowerCase().includes("voided"))).toBe(true);
  });
});
