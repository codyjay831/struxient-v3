/**
 * Head-version workspace readiness: pure derivation from workspace/history fields only.
 * Does not call scope/lifecycle/freeze APIs — avoids duplicate truth and hidden drift.
 *
 * Step model (canon-aligned, see `docs/canon/03-quote-to-execution-canon.md` and
 * `docs/canon/06-node-and-flowspec-canon.md`):
 *   1. Review scope & line items   — line items + packets define the sold work
 *   2. Pin process template        — node/stage skeleton the work runs through
 *   3. Prepare & send proposal     — compose + freeze
 *   4. Record signature            — customer acceptance
 *   5. Activate execution          — instantiate runtime tasks on pinned template
 */

/** Subset of `QuoteVersionHistoryItemDto` (+ derived line item count) — keep in sync manually. */
export type QuoteHeadReadinessInput = {
  id: string;
  versionNumber: number;
  status: "DRAFT" | "SENT" | "SIGNED" | string;
  /** Count of QuoteLineItem rows on the head version. Drives "scope authored" check. */
  lineItemCount: number;
  hasPinnedWorkflow: boolean;
  hasFrozenArtifacts: boolean;
  hasActivation: boolean;
  proposalGroupCount: number;
  sentAt: string | null;
  signedAt: string | null;
  /**
   * Optional pre-derived packet/stage readiness signal. When provided, the
   * checklist gains a "Field-work lines are stage-ready" row sourced
   * verbatim from the same per-line execution preview the scope editor
   * already shows — so the workspace cannot silently disagree with the
   * editor about which lines need attention.
   *
   * Omit (null/undefined) on routes that don't have execution preview data
   * loaded (e.g. workspace shell paths that intentionally skip the read).
   * Absence preserves prior behavior — no checklist row is added.
   */
  packetStageReadiness?: {
    state: "yes" | "no" | "n/a";
    note?: string;
  } | null;
};

export type ReadinessChecklistItem = {
  id: string;
  label: string;
  state: "yes" | "no" | "n/a";
  note?: string;
};

export type QuoteHeadWorkspaceReadiness =
  | { kind: "no_versions" }
  | {
      kind: "head";
      versionNumber: number;
      quoteVersionId: string;
      status: string;
      checklist: ReadinessChecklistItem[];
      likelyNextSteps: string[];
      recommendedStepIndex: number | null; // 1-indexed to match UI steps
      honestyNotes: string[];
    };

function checklistItem(
  id: string,
  label: string,
  state: ReadinessChecklistItem["state"],
  note?: string,
): ReadinessChecklistItem {
  return note != null && note !== "" ? { id, label, state, note } : { id, label, state };
}

/**
 * Derives a compact readiness view for the **head** (newest) version only.
 *
 * Recommendation order is canon-faithful: scope authoring is the primary authoring step,
 * the process-template pin is a structural prerequisite for compose, and send/sign/activate
 * follow. Send "readiness" for drafts is intentionally partial — compose errors / empty plan
 * are only knowable via compose-preview + send-time compose.
 */
export function deriveQuoteHeadWorkspaceReadiness(head: QuoteHeadReadinessInput | null): QuoteHeadWorkspaceReadiness {
  if (!head) {
    return { kind: "no_versions" };
  }

  const { status } = head;
  const hasScope = head.lineItemCount > 0;

  const checklist: ReadinessChecklistItem[] = [
    checklistItem(
      "scope",
      "Scope authored (line items present)",
      hasScope ? "yes" : "no",
      status === "DRAFT"
        ? hasScope
          ? `${String(head.lineItemCount)} line item(s) on this draft. Line items + packets define the sold work.`
          : "No line items yet — author scope before pinning a process template or sending."
        : hasScope
          ? "Frozen scope from this version is what activation will instantiate."
          : "Unusual for sent/signed — no line items recorded on this version.",
    ),
    checklistItem(
      "pin",
      "Process template pinned",
      head.hasPinnedWorkflow ? "yes" : "no",
      status === "DRAFT"
        ? head.hasPinnedWorkflow
          ? "Required before send; the template provides the node/stage skeleton compose places line items onto."
          : "Missing — pin a published process template so packets can be composed onto its nodes."
        : status === "SENT" || status === "SIGNED" || status === "DECLINED"
          ? head.hasPinnedWorkflow
            ? "Expected after a normal send (snapshots are tied to a process template version)."
            : "Unusual for sent/signed — verify data or history."
          : undefined,
    ),
    checklistItem(
      "frozen",
      "Frozen plan/package snapshot recorded",
      head.hasFrozenArtifacts ? "yes" : "no",
      status === "DRAFT"
        ? "Usually false while still draft; send records hashes."
        : "After send, expect yes; use freeze read for detail.",
    ),
    checklistItem(
      "activation",
      "Activation row exists",
      head.hasActivation ? "yes" : "no",
      status === "DRAFT" || status === "SENT"
        ? "Activation follows sign in the normal pipeline (not expected on draft/sent-only)."
        : status === "DECLINED"
          ? "Customer declined this revision on the portal — not eligible for activation."
          : status === "SIGNED"
          ? head.hasActivation
            ? "Post-activate — use lifecycle + runtime reads as appropriate."
            : "Signed but not activated — POST activate when prerequisites are met."
          : undefined,
    ),
    checklistItem(
      "groups",
      "Proposal groups on this version",
      head.proposalGroupCount > 0 ? "yes" : "no",
      `${String(head.proposalGroupCount)} group(s) — structural hint only; does not prove compose will pass.`,
    ),
  ];

  // Optional packet/stage row sourced from per-line execution preview. We
  // only append when the caller actually loaded preview data — absence
  // means "unknown from this surface", not "passed". This preserves prior
  // behavior on routes that don't load preview support.
  if (head.packetStageReadiness != null) {
    checklist.push(
      checklistItem(
        "packets",
        "Field-work lines are stage-ready",
        head.packetStageReadiness.state,
        head.packetStageReadiness.note,
      ),
    );
  }

  const likelyNextSteps: string[] = [];
  let recommendedStepIndex: number | null = null;
  const honestyNotes: string[] = [
    "This summary uses workspace/history fields only. It does not embed scope, lifecycle, or freeze JSON.",
    "Line items + packets define the sold work. The process template only defines the node/stage skeleton.",
  ];

  if (status === "DRAFT") {
    honestyNotes.push(
      "Whether send will succeed is not fully knowable here: send re-runs compose server-side; run compose-preview for validation and staleness token.",
    );

    if (!hasScope) {
      recommendedStepIndex = 1; // Review scope & line items
      likelyNextSteps.push(
        "Add line items / scope packets to this draft — line items are the primary scope authoring object.",
      );
      likelyNextSteps.push(
        "Then pin a published process template (the node/stage skeleton compose places work onto).",
      );
    } else if (!head.hasPinnedWorkflow) {
      recommendedStepIndex = 2; // Pin process template
      likelyNextSteps.push(
        "Pin a published process template: PATCH /api/quote-versions/{id} with pinnedWorkflowVersionId (office_mutate). The template defines the node/stage skeleton — your line items / packets supply the work.",
      );
      likelyNextSteps.push(
        "Then run compose preview and send — packets are composed onto the pinned template's nodes.",
      );
    } else {
      recommendedStepIndex = 3; // Prepare & send proposal
      likelyNextSteps.push("Validate scope: open scope dev page or GET …/scope.");
      likelyNextSteps.push(
        "When ready: run compose preview, then send (freeze) using the compose staleness token — see panel below.",
      );
    }
  } else if (status === "SENT") {
    recommendedStepIndex = 4; // Record signature
    likelyNextSteps.push("Inspect artifacts: GET …/freeze and …/lifecycle for this version.");
    likelyNextSteps.push("Next lifecycle move: POST …/sign when business rules allow (body/actor requirements unchanged).");
  } else if (status === "SIGNED") {
    if (!head.hasActivation) {
      recommendedStepIndex = 5; // Activate execution
      likelyNextSteps.push("Inspect: GET …/lifecycle, …/freeze as needed.");
      likelyNextSteps.push("If eligible: POST …/activate (separate prerequisites — see route docs).");
    } else {
      recommendedStepIndex = null; // Done
      likelyNextSteps.push("Activation exists: follow runtime / flow-group execution reads (not shown in this workspace slice).");
    }
  } else if (status === "DECLINED") {
    recommendedStepIndex = null;
    honestyNotes.push(
      "This revision was declined by the customer on the portal. Frozen payloads are retained for audit; it is not signable.",
    );
    likelyNextSteps.push("Review decline reason in version history or the signature step panel, then prepare a new draft if appropriate.");
  } else if (status === "VOID") {
    recommendedStepIndex = null;
    honestyNotes.push("This revision was voided (withdrawn). Frozen payloads are retained for audit; it is not signable.");
    likelyNextSteps.push("Use version history: create or open a non-void draft to continue commercial work.");
  } else if (status === "SUPERSEDED") {
    recommendedStepIndex = null;
    honestyNotes.push(
      "This revision was superseded when a newer version was sent. It is not the active customer proposal.",
    );
    likelyNextSteps.push("Open the newest SENT or draft row in revision history for current work.");
  } else {
    likelyNextSteps.push("Unknown status — treat lifecycle reads as source of truth.");
  }

  return {
    kind: "head",
    versionNumber: head.versionNumber,
    quoteVersionId: head.id,
    status,
    checklist,
    likelyNextSteps,
    recommendedStepIndex,
    honestyNotes,
  };
}
