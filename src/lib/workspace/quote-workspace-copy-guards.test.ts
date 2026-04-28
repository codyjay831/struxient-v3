import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  deriveQuoteHeadWorkspaceReadiness,
  type QuoteHeadReadinessInput,
} from "./derive-quote-head-workspace-readiness";
import { composeSendProposalDisabledReason } from "./quote-workspace-send-disabled-reason";
import { quoteVersionCompareToPriorPlain } from "./quote-version-compare-copy";
import type { QuoteVersionCompareToPriorDto } from "@/server/slice1/reads/quote-version-history-reads";

/** Substrings that must not appear in default office readiness / revision summary copy. */
const FORBIDDEN = [
  "GET ",
  "POST ",
  "/lifecycle",
  "/freeze",
  "staleness token",
  "stalenessToken",
  "template pin",
  "node skeleton",
  "workflow selection",
  "targetNodeKey",
  "MANIFEST",
  "SOLD_SCOPE",
  "CUSTOMER_PORTAL_ACCEPTED",
  "frozen execution package",
  "instantiate runtime",
] as const;

function base(over: Partial<QuoteHeadReadinessInput> = {}): QuoteHeadReadinessInput {
  return {
    id: "qv_test_copy_guard",
    versionNumber: 2,
    status: "DRAFT",
    lineItemCount: 1,
    hasPinnedWorkflow: true,
    hasFrozenArtifacts: false,
    hasActivation: false,
    proposalGroupCount: 1,
    sentAt: null,
    signedAt: null,
    ...over,
  };
}

function assertNoForbidden(haystack: string) {
  const lower = haystack.toLowerCase();
  for (const f of FORBIDDEN) {
    expect(lower.includes(f.toLowerCase()), `unexpected "${f}" in:\n${haystack}`).toBe(false);
  }
}

function collectHeadReadinessBlob(r: Extract<ReturnType<typeof deriveQuoteHeadWorkspaceReadiness>, { kind: "head" }>) {
  return [
    ...r.checklist.flatMap((c) => [c.label, c.note ?? ""]),
    ...r.likelyNextSteps,
    ...r.honestyNotes,
    r.recommendedStepTitle ?? "",
  ].join("\n");
}

describe("quote workspace copy guards", () => {
  it("readiness derivation never emits forbidden phrases across representative statuses", () => {
    const fixtures: QuoteHeadReadinessInput[] = [
      base({ status: "DRAFT", lineItemCount: 0, hasPinnedWorkflow: false }),
      base({ status: "DRAFT", lineItemCount: 2, hasPinnedWorkflow: false }),
      base({ status: "DRAFT", lineItemCount: 2, hasPinnedWorkflow: true }),
      base({
        status: "DRAFT",
        lineItemCount: 2,
        hasPinnedWorkflow: true,
        packetStageReadiness: { state: "no", note: "needs attention" },
      }),
      base({
        status: "SENT",
        lineItemCount: 2,
        hasFrozenArtifacts: true,
        sentAt: "2026-01-01T00:00:00.000Z",
      }),
      base({
        status: "SIGNED",
        lineItemCount: 2,
        hasFrozenArtifacts: true,
        hasActivation: false,
        signedAt: "2026-01-02T00:00:00.000Z",
      }),
      base({
        status: "SIGNED",
        lineItemCount: 2,
        hasFrozenArtifacts: true,
        hasActivation: true,
        signedAt: "2026-01-02T00:00:00.000Z",
      }),
      base({ status: "VOID", lineItemCount: 1, hasFrozenArtifacts: true }),
      base({ status: "DECLINED", lineItemCount: 1, hasFrozenArtifacts: true }),
      base({ status: "SUPERSEDED", lineItemCount: 1, hasFrozenArtifacts: true }),
    ];
    for (const input of fixtures) {
      const r = deriveQuoteHeadWorkspaceReadiness(input);
      if (r.kind !== "head") continue;
      assertNoForbidden(collectHeadReadinessBlob(r));
    }
  });

  it("office shell gates dev quick jump on NODE_ENV development", () => {
    const file = path.resolve(__dirname, "../../components/quotes/workspace/quote-workspace-shell-summary.tsx");
    const src = readFileSync(file, "utf8");
    expect(src).toMatch(/NODE_ENV === ["']development["']/);
    expect(src).toContain("InternalQuickJump");
  });

  it("compose send disabled reasons stay plain English (no staleness wording)", () => {
    const a = composeSendProposalDisabledReason({
      hasPinnedWorkflow: false,
      hasLastCompose: false,
      composeBlocking: false,
      stalenessTokenForSendDefined: false,
    });
    expect(a?.toLowerCase()).not.toContain("staleness");
    expect(a?.toLowerCase()).not.toContain("token");
    const b = composeSendProposalDisabledReason({
      hasPinnedWorkflow: true,
      hasLastCompose: false,
      composeBlocking: false,
      stalenessTokenForSendDefined: false,
    });
    expect(b?.toLowerCase()).toContain("preview");
  });

  it("revision vs-prior plain summary never includes hash or template-pin language", () => {
    const c: QuoteVersionCompareToPriorDto = {
      priorVersionId: "qv_prior_1",
      priorVersionNumber: 1,
      lineItemCountDelta: 2,
      proposalGroupCountDelta: 1,
      frozenPlanAndPackageIdentical: true,
      pinnedWorkflowVersionIdMatch: false,
    };
    const plain = quoteVersionCompareToPriorPlain(c);
    assertNoForbidden(plain);
    expect(plain.toLowerCase()).not.toContain("hash");
    expect(plain.toLowerCase()).not.toContain("pin");
  });
});
