/**
 * Head-version workspace readiness: pure derivation from workspace/history fields only.
 * Does not call scope/lifecycle/freeze APIs — avoids duplicate truth and hidden drift.
 *
 * Step model (Path B / Triangle Mode — see `docs/canon/03-quote-to-execution-canon.md`):
 *   1. Build the quote              — author line items (line items + packets define the sold work)
 *   2. Review proposed execution flow — verify stages and tasks before send
 *   3. Send proposal                — compose + freeze
 *   4. Record signature             — customer acceptance
 *   5. Activate execution           — instantiate runtime tasks from frozen package
 *
 * Implementation notes:
 *   - The canonical execution-stages workflow is auto-pinned at quote-version
 *     creation (`ensureCanonicalWorkflowVersionInTransaction`). The
 *     "execution flow bound" check below should pass for any quote created
 *     after the Path B rollout; an unbound head signals legacy data or an
 *     internal failure rather than user authoring work.
 *   - User-facing copy here MUST NOT mention "pin a process template",
 *     "node skeleton", "workflow skeleton", or `targetNodeKey`. Those are
 *     internal implementation details under Path B.
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
 * Recommendation order under Path B: scope authoring is the primary user
 * step, then the operator reviews the proposed execution flow generated
 * from line items + task packets, then send/sign/activate. The execution-
 * stages workflow is auto-pinned at creation, so the "execution flow
 * bound" check below is normally a system-level signal rather than user
 * authoring guidance.
 *
 * Send "readiness" for drafts is intentionally partial — compose errors /
 * empty plan are only knowable via compose-preview + send-time compose.
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
          ? `${String(head.lineItemCount)} line item(s) on this draft. Line items and their task packets define the sold work.`
          : "No line items yet — add line items in step 1 before reviewing the execution flow or sending."
        : hasScope
          ? "Frozen scope from this version is what activation will instantiate."
          : "Unusual for sent/signed — no line items recorded on this version.",
    ),
    checklistItem(
      "pin",
      "Execution flow bound",
      head.hasPinnedWorkflow ? "yes" : "no",
      status === "DRAFT"
        ? head.hasPinnedWorkflow
          ? "The proposed execution flow is bound to this draft. Review it in step 2 before sending."
          : "Internal: execution flow not bound. New quotes auto-bind on creation; an unbound head signals legacy data — contact support or use the admin override."
        : status === "SENT" || status === "SIGNED" || status === "DECLINED"
          ? head.hasPinnedWorkflow
            ? "Expected after a normal send — the frozen snapshot is bound to the execution flow version."
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
    "Line items and their task packets define the sold work. Stages organize the work; task packets define the actual tasks, order, blockers, and proof requirements.",
  ];

  if (status === "DRAFT") {
    honestyNotes.push(
      "Whether send will succeed is not fully knowable here: send re-runs compose server-side; run compose-preview for validation and staleness token.",
    );

    if (!hasScope) {
      recommendedStepIndex = 1; // Build the quote
      likelyNextSteps.push(
        "Add line items to this draft — line items are the primary scope authoring object. Field-work lines also need a task packet attached.",
      );
      likelyNextSteps.push(
        "Then review the proposed execution flow (step 2) before sending.",
      );
    } else if (!head.hasPinnedWorkflow) {
      recommendedStepIndex = 2; // Review proposed execution flow (system-bind issue surfaces here)
      likelyNextSteps.push(
        "Internal: this draft is not bound to an execution flow version. New quotes auto-bind on creation, so this row indicates legacy data or an internal failure. Contact support or use the admin override in technical details.",
      );
    } else if (head.packetStageReadiness != null && head.packetStageReadiness.state === "no") {
      // Scope authored and flow bound, but the per-line execution preview
      // surfaced field-work lines that need attention (missing packet,
      // off-stage assignment, etc). The operator needs to revisit step 2 /
      // the line-item editor before sending — sending now would freeze a
      // plan with known stage placement issues.
      recommendedStepIndex = 2;
      likelyNextSteps.push(
        "Review the proposed execution flow (step 2) — one or more field-work lines need attention before sending.",
      );
      likelyNextSteps.push(
        "Open the line-item editor to attach a task packet or move tasks back to a canonical stage.",
      );
    } else {
      // Happy path under Path B: scope is authored, the canonical execution
      // flow is auto-pinned, and there are no per-line warnings. The
      // operator can review step 2 if they want and then send (step 3).
      recommendedStepIndex = 3;
      likelyNextSteps.push(
        "Review the proposed execution flow (step 2) if you want to verify stages and tasks before sending.",
      );
      likelyNextSteps.push(
        "When ready: run compose preview, then send (freeze) using the compose staleness token — see step 3.",
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
