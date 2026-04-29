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
  it("empty draft: hero visible with Add or edit line items CTA", () => {
    const v = view(base({ status: "DRAFT", lineItemCount: 0, hasPinnedWorkflow: false }));
    expect(v.headline.toLowerCase()).toContain("start here");
    expect(v.blockerLine).toBeNull();
    expect(v.primary.label).toBe("Add or edit line items");
    expect(v.primary.href).toBe("#step-1");
    expect(v.secondary).toBeNull();
  });

  it("draft step 2: prominent card with short blocker for work plan row", () => {
    const v = view(base({ status: "DRAFT", lineItemCount: 2, hasPinnedWorkflow: false }));
    expect(v.blockerLine).toBe("Work plan is not attached to this draft yet.");
  });

  it("draft with scope warnings recommends fix work plan + crew-work style body", () => {
    const v = view(
      base({
        status: "DRAFT",
        lineItemCount: 2,
        hasPinnedWorkflow: true,
        packetStageReadiness: { state: "no", note: "1 of 2 line(s) with crew work need attention." },
      }),
    );
    expect(v.blockerLine).toBe("Crew work setup on this draft needs attention before you can send.");
    expect(v.headline.toLowerCase()).toContain("review work plan");
    expect(v.body.toLowerCase()).toMatch(/crew work|attention/);
    expect(v.primary.label).toBe("Fix line items & crew tasks");
    expect(v.primary.href).toBe("#step-1");
  });

  it("ready draft: send headline + preview & send; no activation-style blocker", () => {
    const v = view(base({ status: "DRAFT", lineItemCount: 2, hasPinnedWorkflow: true, proposalGroupCount: 2 }));
    expect(v.headline.toLowerCase()).toContain("send proposal");
    expect(v.body.toLowerCase()).toContain("preview");
    expect(v.primary.label).toBe("Preview & send proposal");
    expect(v.primary.href).toBe("#step-3");
    expect(v.blockerLine?.toLowerCase() ?? "").not.toContain("execution");
    expect(v.blockerLine?.toLowerCase() ?? "").not.toContain("not been started");
  });

  it("sent: waiting on customer + record customer approval", () => {
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
    expect(v.headline.toLowerCase()).toBe("waiting on customer");
    expect(v.headline.toLowerCase()).not.toContain("before you can send");
    expect(v.primary.label).toBe("Record customer approval");
    expect(v.secondary?.label).toBe("Open customer portal");
  });

  it("signed without activation: Start work CTA", () => {
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
    expect(v.headline.toLowerCase()).toContain("ready to start work");
    expect(v.primary.label).toBe("Start work");
  });

  it("signed with activation: Open job", () => {
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
    expect(v.headline.toLowerCase()).toContain("work in progress");
    expect(v.primary.label).toBe("Open job");
    expect(v.primary.href).toBe("#execution-bridge");
  });

  it("shell summary nests InternalQuickJump after More info disclosure", () => {
    const src = readFileSync(
      path.resolve(__dirname, "../../components/quotes/workspace/quote-workspace-shell-summary.tsx"),
      "utf8",
    );
    const more = src.indexOf(">More info</summary>");
    const qj = src.indexOf("<InternalQuickJump");
    expect(more).toBeGreaterThan(-1);
    expect(qj).toBeGreaterThan(more);
  });
});
