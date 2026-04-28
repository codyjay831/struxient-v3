import type { QuoteHeadWorkspaceReadiness } from "./derive-quote-head-workspace-readiness";

export type QuoteWorkspaceNextActionCta = {
  label: string;
  href: string;
  external?: boolean;
};

export type QuoteWorkspaceNextActionCardLayout = "hidden" | "prominent";

export type QuoteWorkspaceNextActionView = {
  /**
   * `hidden`: Step 1 is the first visible pipeline block — skip the large top card to avoid duplicate CTAs.
   * `prominent`: render the blue next-action card.
   */
  cardLayout: QuoteWorkspaceNextActionCardLayout;
  headline: string;
  body: string;
  blockerLine: string | null;
  primary: QuoteWorkspaceNextActionCta;
  secondary: QuoteWorkspaceNextActionCta | null;
};

export type QuoteWorkspaceNextActionOptions = {
  sentPortalShareToken: string | null;
  /** Head row: signed and activation exists (execution already started). */
  headHasActivation: boolean;
};

/** Short plain sentence for the prominent card — not full checklist labels. */
function shortBlockerLine(r: Extract<QuoteHeadWorkspaceReadiness, { kind: "head" }>): string | null {
  const missing = r.checklist.filter((c) => c.state === "no");
  if (missing.length === 0) return null;
  /** Draft rows include `activation: no` before `packets`; surface actionable pre-send rows first. */
  const draftOrder = ["scope", "pin", "packets", "groups", "frozen", "activation"] as const;
  const m =
    r.status === "DRAFT" ?
      draftOrder.map((id) => missing.find((c) => c.id === id)).find(Boolean) ?? missing[0]!
    : missing[0]!;
  if (m.id === "scope") return "No line items yet.";
  if (m.id === "pin") return "Work plan is not attached to this draft yet.";
  if (m.id === "packets") return "Field work on this draft needs attention before you can send.";
  if (m.id === "frozen") return "This revision is not in a sent-and-locked state yet.";
  if (m.id === "activation") return "Execution has not been started for this revision yet.";
  if (m.id === "groups") return "Proposal groups may need attention before sending.";
  return "Something on this revision needs attention before you continue.";
}

function draftStep2Body(r: Extract<QuoteHeadWorkspaceReadiness, { kind: "head" }>): string {
  const packetRow = r.checklist.find((c) => c.id === "packets");
  if (packetRow?.state === "no" && packetRow.note?.trim()) {
    return packetRow.note;
  }
  return "Some field work needs attention before this quote can be sent, or the work plan is not ready.";
}

/**
 * First-screen command center copy + CTAs. Uses `deriveQuoteHeadWorkspaceReadiness` output only
 * (no duplicate lifecycle rules).
 */
export function buildQuoteWorkspaceNextActionView(
  readiness: QuoteHeadWorkspaceReadiness,
  quoteId: string,
  options: QuoteWorkspaceNextActionOptions,
): QuoteWorkspaceNextActionView {
  if (readiness.kind === "no_versions") {
    return {
      cardLayout: "prominent",
      headline: "Get this quote ready",
      body: "No revisions are on file yet. Create a version to add line items and continue the commercial pipeline.",
      blockerLine: null,
      primary: { label: "Back to quotes", href: "/quotes" },
      secondary: null,
    };
  }

  const r = readiness;
  const idx = r.recommendedStepIndex;
  const stepTitle = r.recommendedStepTitle;
  const blocker = shortBlockerLine(r);

  if (r.status === "SENT" && idx === 4) {
    return {
      cardLayout: "prominent",
      headline: "Waiting on customer",
      body: "The proposal has been sent and locked. Record the signature when the customer has approved.",
      blockerLine: blocker,
      primary: { label: "Record signature", href: "#step-4" },
      secondary:
        options.sentPortalShareToken ?
          {
            label: "Open customer portal",
            href: `/portal/quotes/${encodeURIComponent(options.sentPortalShareToken)}`,
            external: true,
          }
        : null,
    };
  }

  if (r.status === "SIGNED" && options.headHasActivation) {
    return {
      cardLayout: "prominent",
      headline: "Execution is active",
      body: r.likelyNextSteps[0] ?? "Use Execution bridge to open the work feed and track progress.",
      blockerLine: null,
      primary: { label: "Open execution bridge", href: "#execution-bridge" },
      secondary: null,
    };
  }

  if (r.status === "SIGNED" && idx === 5) {
    return {
      cardLayout: "prominent",
      headline: "Ready to start work",
      body: "The quote is signed. Activate execution to create the job task list.",
      blockerLine: blocker,
      primary: { label: "Activate execution", href: "#step-5" },
      secondary: null,
    };
  }

  if (r.status === "DECLINED") {
    return {
      cardLayout: "prominent",
      headline: "Customer declined",
      body: r.likelyNextSteps[0] ?? "This revision cannot be signed. Review the reason and prepare a new draft if needed.",
      blockerLine: null,
      primary: { label: "Revision & scope", href: "#revision-management" },
      secondary: { label: "View revision history", href: "#revision-history" },
    };
  }

  if (r.status === "VOID") {
    return {
      cardLayout: "prominent",
      headline: "Revision withdrawn",
      body: r.likelyNextSteps[0] ?? "Open or create a draft from revision history to continue.",
      blockerLine: null,
      primary: { label: "Revision management", href: "#revision-management" },
      secondary: { label: "View revision history", href: "#revision-history" },
    };
  }

  if (r.status === "SUPERSEDED") {
    return {
      cardLayout: "prominent",
      headline: "Older revision",
      body: r.likelyNextSteps[0] ?? "A newer version was sent. Open the newest row in revision history.",
      blockerLine: null,
      primary: { label: "View revision history", href: "#revision-history" },
      secondary: null,
    };
  }

  if (r.status === "DRAFT" && idx === 1) {
    return {
      cardLayout: "hidden",
      headline: stepTitle ? `Next: ${stepTitle}` : "Next: Build the quote",
      body:
        "Add line items in the pipeline below, then continue through review and send when you are ready.",
      blockerLine: null,
      primary: { label: "Add line items", href: `/quotes/${quoteId}/scope` },
      secondary: { label: "View pipeline step", href: "#step-1" },
    };
  }

  if (r.status === "DRAFT" && idx === 2) {
    return {
      cardLayout: "prominent",
      headline: stepTitle ? `Next: ${stepTitle}` : "Next: Review execution flow",
      body: draftStep2Body(r),
      blockerLine: blocker,
      primary: { label: "Review execution flow", href: "#step-2" },
      secondary: { label: "Open scope editor", href: `/quotes/${quoteId}/scope` },
    };
  }

  if (r.status === "DRAFT" && idx === 3) {
    return {
      cardLayout: "prominent",
      headline: stepTitle ? `Next: ${stepTitle}` : "Next: Send proposal",
      body: "Preview the proposal, then send it to lock this version for the customer.",
      blockerLine: blocker,
      primary: { label: "Preview & send proposal", href: "#step-3" },
      secondary: { label: "Review execution flow", href: "#step-2" },
    };
  }

  const headline = stepTitle && idx != null ? `Next: ${stepTitle}` : "Quote status";
  const body = r.likelyNextSteps[0] ?? "Review the checklist and pipeline for this revision.";
  return {
    cardLayout: "prominent",
    headline,
    body,
    blockerLine: blocker,
    primary:
      idx != null ? { label: `Go to step ${idx}`, href: `#step-${idx}` } : { label: "View pipeline", href: "#step-1" },
    secondary: null,
  };
}
