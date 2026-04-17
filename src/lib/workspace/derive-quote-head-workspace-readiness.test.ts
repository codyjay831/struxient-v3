import { describe, expect, it } from "vitest";
import { deriveQuoteHeadWorkspaceReadiness, type QuoteHeadReadinessInput } from "./derive-quote-head-workspace-readiness";

function base(over: Partial<QuoteHeadReadinessInput> = {}): QuoteHeadReadinessInput {
  return {
    id: "qv_test_0000000000000001",
    versionNumber: 1,
    status: "DRAFT",
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

  it("draft without pin mentions PATCH and compose honesty", () => {
    const r = deriveQuoteHeadWorkspaceReadiness(base({ status: "DRAFT", hasPinnedWorkflow: false }));
    expect(r.kind).toBe("head");
    if (r.kind !== "head") return;
    expect(r.status).toBe("DRAFT");
    const pin = r.checklist.find((c) => c.id === "pin");
    expect(pin?.state).toBe("no");
    expect(r.likelyNextSteps.some((s) => s.includes("PATCH"))).toBe(true);
    expect(r.honestyNotes.some((s) => s.includes("compose-preview"))).toBe(true);
  });

  it("draft with pin points at compose then send", () => {
    const r = deriveQuoteHeadWorkspaceReadiness(base({ status: "DRAFT", hasPinnedWorkflow: true }));
    expect(r.kind).toBe("head");
    if (r.kind !== "head") return;
    expect(r.checklist.find((c) => c.id === "pin")?.state).toBe("yes");
    expect(r.likelyNextSteps.some((s) => s.toLowerCase().includes("compose preview"))).toBe(true);
  });

  it("sent suggests sign and reads", () => {
    const r = deriveQuoteHeadWorkspaceReadiness(
      base({
        status: "SENT",
        hasPinnedWorkflow: true,
        hasFrozenArtifacts: true,
        sentAt: "2026-01-01T00:00:00.000Z",
      }),
    );
    expect(r.kind).toBe("head");
    if (r.kind !== "head") return;
    expect(r.likelyNextSteps.some((s) => s.includes("/sign"))).toBe(true);
    expect(r.likelyNextSteps.some((s) => s.includes("freeze") || s.includes("lifecycle"))).toBe(true);
  });

  it("signed without activation suggests activate", () => {
    const r = deriveQuoteHeadWorkspaceReadiness(
      base({
        status: "SIGNED",
        hasPinnedWorkflow: true,
        hasFrozenArtifacts: true,
        hasActivation: false,
        signedAt: "2026-01-02T00:00:00.000Z",
      }),
    );
    expect(r.kind).toBe("head");
    if (r.kind !== "head") return;
    expect(r.likelyNextSteps.some((s) => s.includes("/activate"))).toBe(true);
  });

  it("signed with activation mentions runtime", () => {
    const r = deriveQuoteHeadWorkspaceReadiness(
      base({ status: "SIGNED", hasPinnedWorkflow: true, hasFrozenArtifacts: true, hasActivation: true }),
    );
    expect(r.kind).toBe("head");
    if (r.kind !== "head") return;
    expect(r.likelyNextSteps.some((s) => s.toLowerCase().includes("runtime"))).toBe(true);
  });
});
