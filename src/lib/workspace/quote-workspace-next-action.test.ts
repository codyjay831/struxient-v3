import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { deriveQuoteHeadWorkspaceReadiness, type QuoteHeadReadinessInput } from "./derive-quote-head-workspace-readiness";
import { buildQuoteWorkspaceNextActionView } from "./quote-workspace-next-action";

function base(over: Partial<QuoteHeadReadinessInput> = {}): QuoteHeadReadinessInput {
  return {
    id: "qv_na_test",
    versionNumber: 1,
    status: "DRAFT",
    lineItemCount: 0,
    hasPinnedWorkflow: false,
    hasFrozenArtifacts: false,
    hasActivation: false,
    proposalGroupCount: 0,
    sentAt: null,
    signedAt: null,
    ...over,
  };
}

function view(
  input: QuoteHeadReadinessInput,
  opts: { sentPortalShareToken?: string | null; headHasActivation?: boolean } = {},
) {
  const readiness = deriveQuoteHeadWorkspaceReadiness(input);
  return buildQuoteWorkspaceNextActionView(readiness, "quote_test_1", {
    sentPortalShareToken: opts.sentPortalShareToken ?? null,
    headHasActivation: opts.headHasActivation ?? false,
  });
}

describe("buildQuoteWorkspaceNextActionView", () => {
  it("empty draft: hides prominent card; pipeline step 1 carries the CTA", () => {
    const v = view(base({ status: "DRAFT", lineItemCount: 0, hasPinnedWorkflow: false }));
    expect(v.cardLayout).toBe("hidden");
    expect(v.blockerLine).toBeNull();
    expect(v.primary.label).toBe("Add line items");
    expect(v.primary.href).toBe("/quotes/quote_test_1/scope");
  });

  it("draft step 2: prominent card with short blocker for work plan row", () => {
    const v = view(base({ status: "DRAFT", lineItemCount: 2, hasPinnedWorkflow: false }));
    expect(v.cardLayout).toBe("prominent");
    expect(v.blockerLine).toBe("Work plan is not attached to this draft yet.");
  });

  it("draft with scope warnings recommends review flow + field-work style body", () => {
    const v = view(
      base({
        status: "DRAFT",
        lineItemCount: 2,
        hasPinnedWorkflow: true,
        packetStageReadiness: { state: "no", note: "1 of 2 field-work line(s) need attention." },
      }),
    );
    expect(v.cardLayout).toBe("prominent");
    expect(v.blockerLine).toBe("Field work on this draft needs attention before you can send.");
    expect(v.headline.toLowerCase()).toContain("review execution flow");
    expect(v.body.toLowerCase()).toMatch(/field.work|attention/);
    expect(v.primary.label).toBe("Review execution flow");
    expect(v.primary.href).toBe("#step-2");
  });

  it("ready draft: Next Send proposal + preview & send", () => {
    const v = view(base({ status: "DRAFT", lineItemCount: 2, hasPinnedWorkflow: true }));
    expect(v.cardLayout).toBe("prominent");
    expect(v.headline.toLowerCase()).toContain("send proposal");
    expect(v.body.toLowerCase()).toContain("preview");
    expect(v.primary.label).toBe("Preview & send proposal");
    expect(v.primary.href).toBe("#step-3");
  });

  it("sent: Waiting on customer — not a draft send-framing headline", () => {
    const v = view(
      base({
        status: "SENT",
        lineItemCount: 2,
        hasPinnedWorkflow: true,
        hasFrozenArtifacts: true,
        sentAt: "2026-01-01T00:00:00.000Z",
      }),
      { sentPortalShareToken: "tok_abc" },
    );
    expect(v.cardLayout).toBe("prominent");
    expect(v.headline.toLowerCase()).toBe("waiting on customer");
    expect(v.headline.toLowerCase()).not.toContain("before you can send");
    expect(v.primary.label).toBe("Record signature");
    expect(v.secondary?.label).toBe("Open customer portal");
  });

  it("signed without activation: Ready to start work + Activate execution", () => {
    const v = view(
      base({
        status: "SIGNED",
        lineItemCount: 2,
        hasPinnedWorkflow: true,
        hasFrozenArtifacts: true,
        hasActivation: false,
        signedAt: "2026-01-02T00:00:00.000Z",
      }),
      { headHasActivation: false },
    );
    expect(v.cardLayout).toBe("prominent");
    expect(v.headline.toLowerCase()).toContain("ready to start work");
    expect(v.primary.label).toBe("Activate execution");
  });

  it("signed with activation: execution is active", () => {
    const v = view(
      base({
        status: "SIGNED",
        lineItemCount: 2,
        hasPinnedWorkflow: true,
        hasFrozenArtifacts: true,
        hasActivation: true,
        signedAt: "2026-01-02T00:00:00.000Z",
      }),
      { headHasActivation: true },
    );
    expect(v.cardLayout).toBe("prominent");
    expect(v.headline.toLowerCase()).toContain("execution is active");
    expect(v.primary.href).toBe("#execution-bridge");
  });

  it("compact office shell nests InternalQuickJump after Advanced summary (not main strip)", () => {
    const src = readFileSync(
      path.resolve(__dirname, "../../components/quotes/workspace/quote-workspace-shell-summary.tsx"),
      "utf8",
    );
    const compactIdx = src.indexOf('variant === "compact"');
    expect(compactIdx).toBeGreaterThan(-1);
    const slice = src.slice(compactIdx);
    const adv = slice.indexOf("Advanced (support)");
    const qj = slice.indexOf("InternalQuickJump");
    expect(adv).toBeGreaterThan(-1);
    expect(qj).toBeGreaterThan(adv);
  });
});
