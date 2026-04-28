import type { QuoteHeadWorkspaceReadiness } from "./derive-quote-head-workspace-readiness";

export type QuoteWorkspaceNextActionCta = {
  label: string;
  href: string;
  external?: boolean;
};

export type QuoteWorkspaceNextActionView = {
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

/**
 * Hero card blockers: only rows relevant to the current lifecycle / recommended step.
 * Never treats post-signature work (activation) as a draft/sent blocker.
 */
function shortBlockerLine(r: Extract<QuoteHeadWorkspaceReadiness, { kind: "head" }>): string | null {
  const missing = r.checklist.filter((c) => c.state === "no");
  if (missing.length === 0) return null;

  const irrelevant = (id: string) => {
    if (id === "activation" && (r.status === "DRAFT" || r.status === "SENT")) return true;
    if (id === "groups" && r.status === "DRAFT") return true;
    return false;
  };

  const relevant = missing.filter((c) => !irrelevant(c.id));
  if (relevant.length === 0) return null;

  const draftOrder = ["scope", "pin", "packets", "frozen"] as const;
  const m =
    r.status === "DRAFT" ?
      draftOrder.map((id) => relevant.find((c) => c.id === id)).find(Boolean) ?? relevant[0]!
    : relevant[0]!;

  if (m.id === "scope") return "No line items yet.";
  if (m.id === "pin") return "Work plan is not attached to this draft yet.";
  if (m.id === "packets") return "Field work on this draft needs attention before you can send.";
  if (m.id === "frozen") return "This revision is not in a sent-and-locked state yet.";
  if (m.id === "activation") return "Work has not been started for this signed version yet.";
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
 * Current-step hero: copy + CTAs from `deriveQuoteHeadWorkspaceReadiness` only
 * (no duplicate lifecycle rules).
 */
export function buildQuoteWorkspaceNextActionView(
  readiness: QuoteHeadWorkspaceReadiness,
  quoteId: string,
  options: QuoteWorkspaceNextActionOptions,
): QuoteWorkspaceNextActionView {
  if (readiness.kind === "no_versions") {
    return {
      headline: "Get this quote ready",
      body: "No revisions are on file yet. Create a version to add line items and continue.",
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
      headline: "Waiting on customer",
      body: "The proposal has been sent and locked. Record customer approval when the customer has agreed.",
      blockerLine: blocker,
      primary: { label: "Record customer approval", href: "#step-4" },
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
      headline: "Work in progress",
      body: r.likelyNextSteps[0] ?? "Open Job execution to view the work feed and track progress.",
      blockerLine: null,
      primary: { label: "Open job", href: "#execution-bridge" },
      secondary: null,
    };
  }

  if (r.status === "SIGNED" && idx === 5) {
    return {
      headline: "Ready to start work",
      body: "The quote is signed. Start work to create the job task list from the locked proposal.",
      blockerLine: blocker,
      primary: { label: "Start work", href: "#step-5" },
      secondary: null,
    };
  }

  if (r.status === "DECLINED") {
    return {
      headline: "Customer declined",
      body: r.likelyNextSteps[0] ?? "This revision cannot be signed. Review the reason and prepare a new draft if needed.",
      blockerLine: null,
      primary: { label: "Update this quote", href: "#start-new-draft" },
      secondary: { label: "Quote versions", href: "#quote-versions" },
    };
  }

  if (r.status === "VOID") {
    return {
      headline: "Revision withdrawn",
      body: r.likelyNextSteps[0] ?? "Open or create a draft from Quote versions to continue.",
      blockerLine: null,
      primary: { label: "Start a new draft", href: "#start-new-draft" },
      secondary: { label: "Quote versions", href: "#quote-versions" },
    };
  }

  if (r.status === "SUPERSEDED") {
    return {
      headline: "Older revision",
      body: r.likelyNextSteps[0] ?? "A newer version was sent. Open the newest row in Quote versions.",
      blockerLine: null,
      primary: { label: "Quote versions", href: "#quote-versions" },
      secondary: null,
    };
  }

  if (r.status === "DRAFT" && idx === 1) {
    return {
      headline: "Start here: build the quote",
      body: "Add or edit line items and tasks first. Proposal-only lines stay on the quote; other lines can attach crew tasks after approval — get those right before you review and send.",
      blockerLine: null,
      primary: { label: "Add or edit line items", href: `/quotes/${quoteId}/scope` },
      secondary: { label: "View quote progress", href: "#step-1" },
    };
  }

  if (r.status === "DRAFT" && idx === 2) {
    return {
      headline: stepTitle ? `Next: ${stepTitle}` : "Next: Review work plan",
      body: draftStep2Body(r),
      blockerLine: blocker,
      primary: { label: "Fix line items & crew tasks", href: `/quotes/${quoteId}/scope` },
      secondary: { label: "Review work plan", href: "#step-2" },
    };
  }

  if (r.status === "DRAFT" && idx === 3) {
    return {
      headline: stepTitle ? `Next: ${stepTitle}` : "Next: Send proposal",
      body: "Preview the proposal, then send it to lock this version for the customer.",
      blockerLine: blocker,
      primary: { label: "Preview & send proposal", href: "#step-3" },
      secondary: { label: "Review work plan", href: "#step-2" },
    };
  }

  const headline = stepTitle && idx != null ? `Next: ${stepTitle}` : "Quote status";
  const body = r.likelyNextSteps[0] ?? "Review the checklist and quote progress for this revision.";
  return {
    headline,
    body,
    blockerLine: blocker,
    primary:
      idx != null ? { label: `Go to step ${idx}`, href: `#step-${idx}` } : { label: "View quote progress", href: "#step-1" },
    secondary: null,
  };
}