import { describe, expect, it } from "vitest";
import {
  deriveQuoteHeadWorkspaceReadiness,
  type QuoteHeadReadinessInput,
} from "./derive-quote-head-workspace-readiness";

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

function allReadinessStrings(r: Extract<ReturnType<typeof deriveQuoteHeadWorkspaceReadiness>, { kind: "head" }>): string {
  const parts = [
    ...r.checklist.flatMap((c) => [c.label, c.note ?? ""]),
    ...r.likelyNextSteps,
    ...r.honestyNotes,
    r.recommendedStepTitle ?? "",
  ];
  return parts.join("\n");
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
    expect(r.recommendedStepTitle).toBe("Build the quote");
    expect(r.checklist.find((c) => c.id === "scope")?.state).toBe("no");
    expect(
      r.likelyNextSteps.some((s) => s.toLowerCase().includes("line item") || s.toLowerCase().includes("scope")),
    ).toBe(true);
  });

  it("draft with scope but unbound execution flow surfaces a system condition at step 2", () => {
    const r = deriveQuoteHeadWorkspaceReadiness(
      base({ status: "DRAFT", lineItemCount: 2, hasPinnedWorkflow: false }),
    );
    expect(r.kind).toBe("head");
    if (r.kind !== "head") return;
    expect(r.recommendedStepIndex).toBe(2);
    expect(r.recommendedStepTitle).toBe("Review execution flow");
    expect(r.checklist.find((c) => c.id === "scope")?.state).toBe("yes");
    const pin = r.checklist.find((c) => c.id === "pin");
    expect(pin?.state).toBe("no");
    expect(pin?.label.toLowerCase()).toContain("work plan");
    expect(pin?.label.toLowerCase()).not.toContain("process template");
    expect(r.likelyNextSteps.some((s) => s.toLowerCase().includes("support"))).toBe(true);
    expect(r.likelyNextSteps.every((s) => !s.includes("PATCH"))).toBe(true);
    expect(r.honestyNotes.some((s) => s.toLowerCase().includes("preview"))).toBe(true);
  });

  it("draft with scope and bound flow points at send (step 3) and offers a review prompt", () => {
    const r = deriveQuoteHeadWorkspaceReadiness(
      base({ status: "DRAFT", lineItemCount: 2, hasPinnedWorkflow: true }),
    );
    expect(r.kind).toBe("head");
    if (r.kind !== "head") return;
    expect(r.recommendedStepIndex).toBe(3);
    expect(r.recommendedStepTitle).toBe("Send proposal");
    expect(r.checklist.find((c) => c.id === "pin")?.state).toBe("yes");
    expect(r.likelyNextSteps.some((s) => s.toLowerCase().includes("preview proposal"))).toBe(true);
    expect(
      r.likelyNextSteps.some((s) => s.toLowerCase().includes("proposed execution flow")),
    ).toBe(true);
  });

  it("draft with scope, bound flow, and packet-stage warnings recommends reviewing the flow (step 2)", () => {
    const r = deriveQuoteHeadWorkspaceReadiness(
      base({
        status: "DRAFT",
        lineItemCount: 2,
        hasPinnedWorkflow: true,
        packetStageReadiness: {
          state: "no",
          note: "1 of 2 field-work line(s) need attention.",
        },
      }),
    );
    expect(r.kind).toBe("head");
    if (r.kind !== "head") return;
    expect(r.recommendedStepIndex).toBe(2);
    expect(r.recommendedStepTitle).toBe("Review execution flow");
    expect(
      r.likelyNextSteps.some((s) => s.toLowerCase().includes("proposed execution flow")),
    ).toBe(true);
    expect(r.likelyNextSteps.some((s) => s.toLowerCase().includes("line-item"))).toBe(true);
  });

  it("sent suggests signature-focused steps without API route language", () => {
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
    expect(r.recommendedStepTitle).toBe("Record signature");
    const blob = allReadinessStrings(r);
    expect(blob.toLowerCase()).not.toContain("get ");
    expect(blob.toLowerCase()).not.toContain("post ");
    expect(blob.toLowerCase()).not.toContain("/lifecycle");
    expect(blob.toLowerCase()).not.toContain("/freeze");
    expect(r.likelyNextSteps.some((s) => s.toLowerCase().includes("portal"))).toBe(true);
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
    expect(r.recommendedStepTitle).toBe("Activate execution");
    const blob = allReadinessStrings(r);
    expect(blob.toLowerCase()).not.toContain("post ");
    expect(blob.toLowerCase()).not.toContain("/activate");
  });

  it("signed with activation clears recommended step and mentions execution bridge", () => {
    const r = deriveQuoteHeadWorkspaceReadiness(
      base({ status: "SIGNED", lineItemCount: 2, hasPinnedWorkflow: true, hasFrozenArtifacts: true, hasActivation: true }),
    );
    expect(r.kind).toBe("head");
    if (r.kind !== "head") return;
    expect(r.recommendedStepIndex).toBeNull();
    expect(r.recommendedStepTitle).toBeNull();
    expect(r.likelyNextSteps.some((s) => s.toLowerCase().includes("execution bridge"))).toBe(true);
  });

  it("honesty notes teach scope-first canon under Path B (no skeleton/pin language)", () => {
    const r = deriveQuoteHeadWorkspaceReadiness(base({ status: "DRAFT", lineItemCount: 2, hasPinnedWorkflow: true }));
    expect(r.kind).toBe("head");
    if (r.kind !== "head") return;
    expect(
      r.honestyNotes.some(
        (s) =>
          s.toLowerCase().includes("line items") &&
          s.toLowerCase().includes("task packets") &&
          s.toLowerCase().includes("stages"),
      ),
    ).toBe(true);
    expect(r.honestyNotes.every((s) => !s.toLowerCase().includes("skeleton"))).toBe(true);
    expect(r.honestyNotes.every((s) => !s.toLowerCase().includes("process template"))).toBe(true);
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

  it("declined head: no recommended step and portal decline honesty note", () => {
    const r = deriveQuoteHeadWorkspaceReadiness(
      base({ status: "DECLINED", lineItemCount: 1, hasPinnedWorkflow: true, hasFrozenArtifacts: true }),
    );
    expect(r.kind).toBe("head");
    if (r.kind !== "head") return;
    expect(r.recommendedStepIndex).toBeNull();
    expect(r.honestyNotes.some((s) => s.toLowerCase().includes("declined"))).toBe(true);
  });

  it("packetStageReadiness omitted: no 'packets' checklist row (preserves prior behavior)", () => {
    const r = deriveQuoteHeadWorkspaceReadiness(
      base({ status: "DRAFT", lineItemCount: 1, hasPinnedWorkflow: true }),
    );
    expect(r.kind).toBe("head");
    if (r.kind !== "head") return;
    expect(r.checklist.find((c) => c.id === "packets")).toBeUndefined();
  });

  it("packetStageReadiness yes: appends a satisfied 'packets' checklist row", () => {
    const r = deriveQuoteHeadWorkspaceReadiness(
      base({
        status: "DRAFT",
        lineItemCount: 2,
        hasPinnedWorkflow: true,
        packetStageReadiness: { state: "yes", note: "2 of 2 field-work line(s) resolve." },
      }),
    );
    expect(r.kind).toBe("head");
    if (r.kind !== "head") return;
    const row = r.checklist.find((c) => c.id === "packets");
    expect(row).toBeDefined();
    expect(row?.state).toBe("yes");
    expect(row?.label.toLowerCase()).toContain("field-work");
    expect(row?.note).toContain("2 of 2");
  });

  it("packetStageReadiness no: appends a needs-attention 'packets' row that surfaces in the missing bucket", () => {
    const r = deriveQuoteHeadWorkspaceReadiness(
      base({
        status: "DRAFT",
        lineItemCount: 2,
        hasPinnedWorkflow: true,
        packetStageReadiness: {
          state: "no",
          note: "1 of 2 field-work line(s) need attention — 1 line(s) have no task packet attached.",
        },
      }),
    );
    expect(r.kind).toBe("head");
    if (r.kind !== "head") return;
    const row = r.checklist.find((c) => c.id === "packets");
    expect(row).toBeDefined();
    expect(row?.state).toBe("no");
    expect(row?.note?.toLowerCase()).toContain("need attention");
  });

  it("draft not sent: frozen checklist row is n/a (not bucketed as missing)", () => {
    const r = deriveQuoteHeadWorkspaceReadiness(
      base({ status: "DRAFT", lineItemCount: 1, hasPinnedWorkflow: true, hasFrozenArtifacts: false }),
    );
    expect(r.kind).toBe("head");
    if (r.kind !== "head") return;
    const frozen = r.checklist.find((c) => c.id === "frozen");
    expect(frozen?.state).toBe("n/a");
    expect(frozen?.label.toLowerCase()).toContain("not sent");
  });
});
