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
 *     "work plan attached" check below should pass for any quote created
 *     after the Path B rollout; an unbound head signals legacy data or an
 *     internal failure rather than user authoring work.
 *   - User-facing copy here MUST NOT mention "pin a process template",
 *     "node skeleton", "workflow skeleton", or `targetNodeKey`. Those are
 *     internal implementation details under Path B.
 */

/** 1-indexed step numbers matching the office workspace pipeline UI. */
export const WORKSPACE_PIPELINE_STEP_TITLES: Record<number, string> = {
  1: "Build the quote",
  2: "Review execution flow",
  3: "Send proposal",
  4: "Record signature",
  5: "Activate execution",
};

export function workspaceRecommendedStepTitle(stepIndex: number | null): string | null {
  if (stepIndex == null) return null;
  return WORKSPACE_PIPELINE_STEP_TITLES[stepIndex] ?? null;
}

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
      /** Plain-language title for `recommendedStepIndex` (office workspace). */
      recommendedStepTitle: string | null;
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
 * stages plan is auto-attached at creation, so the "work plan attached" check
 * below is normally a system-level signal rather than user authoring work.
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
          ? "Line items on this version are what activation uses after sign-off."
          : "Unusual for sent/signed — no line items recorded on this version.",
    ),
    checklistItem(
      "pin",
      "Work plan attached to this draft",
      head.hasPinnedWorkflow ? "yes" : "no",
      status === "DRAFT"
        ? head.hasPinnedWorkflow
          ? "The proposed execution flow is attached. Review it in step 2 before sending."
          : "This draft is not attached to a standard work plan. New quotes attach automatically; if this persists, contact support and use Advanced on this card for the version id."
        : status === "SENT" || status === "SIGNED" || status === "DECLINED"
          ? head.hasPinnedWorkflow
            ? "Expected after send — the locked proposal stays tied to the same work plan version."
            : "Unusual for sent/signed — contact support if this looks wrong."
          : undefined,
    ),
    ...(status === "DRAFT"
      ? [
          head.hasFrozenArtifacts
            ? checklistItem(
                "frozen",
                "Proposal locked on file",
                "yes",
                "This draft already has a locked proposal record (unusual before sending). Contact support if unsure.",
              )
            : checklistItem(
                "frozen",
                "Not sent yet",
                "n/a",
                "Sending locks the customer-visible proposal and work plan.",
              ),
        ]
      : [
          checklistItem(
            "frozen",
            "Proposal sent and locked",
            head.hasFrozenArtifacts ? "yes" : "no",
            head.hasFrozenArtifacts
              ? "After send, the customer-visible proposal and work plan stay locked for audit and sign-off."
              : "Unusual for a sent or signed revision — contact support.",
          ),
        ]),
    checklistItem(
      "activation",
      "Activation recorded",
      head.hasActivation ? "yes" : "no",
      status === "DRAFT" || status === "SENT"
        ? "Activation comes after signature in the normal path (not expected on draft or sent-only)."
        : status === "DECLINED"
          ? "Customer declined this revision on the portal — not eligible for activation."
          : status === "SIGNED"
          ? head.hasActivation
            ? "Execution has been started for this revision."
            : "Signed but not started — use Activate execution when prerequisites are met."
          : undefined,
    ),
    checklistItem(
      "groups",
      "Proposal groups on this version",
      head.proposalGroupCount > 0 ? "yes" : "no",
      `${String(head.proposalGroupCount)} group(s) — structural hint only; run Preview proposal in the Send step to validate.`,
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
    "This card summarizes fields from your workspace history. It is not a substitute for a full commercial or legal review.",
    "Line items define what you sell; task packets define the crew work after approval. Stages group that work in the proposed execution flow.",
  ];

  if (status === "DRAFT") {
    honestyNotes.push(
      "Send can still be blocked by proposal preview errors. Use Preview proposal in the Send step before sending.",
    );

    if (!hasScope) {
      recommendedStepIndex = 1; // Build the quote
      likelyNextSteps.push(
        "Add line items to this draft — line items are the primary scope object. Field-work lines also need a task packet attached.",
      );
      likelyNextSteps.push("Then review the proposed execution flow (step 2) before sending.");
    } else if (!head.hasPinnedWorkflow) {
      recommendedStepIndex = 2; // Review proposed execution flow (system-bind issue surfaces here)
      likelyNextSteps.push(
        "This draft is not attached to a standard work plan. New quotes attach automatically; if this persists, contact support.",
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
        "Open the line-item editor to attach a task packet or move tasks to a standard phase.",
      );
    } else {
      // Happy path under Path B: scope is authored, the canonical execution
      // plan is auto-attached, and there are no per-line warnings. The
      // operator can review step 2 if they want and then send (step 3).
      recommendedStepIndex = 3;
      likelyNextSteps.push(
        "Review the proposed execution flow (step 2) if you want to verify phases and tasks before sending.",
      );
      likelyNextSteps.push(
        "When ready: run Preview proposal, then Send proposal in step 3.",
      );
    }
  } else if (status === "SENT") {
    recommendedStepIndex = 4; // Record signature
    likelyNextSteps.push(
      "Share the customer portal link (step 4), then record the signature when the customer has approved.",
    );
    likelyNextSteps.push("If you use in-office sign-off instead, use Record customer signature when allowed.");
  } else if (status === "SIGNED") {
    if (!head.hasActivation) {
      recommendedStepIndex = 5; // Activate execution
      likelyNextSteps.push("When prerequisites are met, use Activate execution (step 5) to create the job task list.");
      likelyNextSteps.push("If something blocks activation, check the message on the Activate panel or contact support.");
    } else {
      recommendedStepIndex = null; // Done
      likelyNextSteps.push(
        "Execution is already active for this revision. Use Execution bridge on this page to open the work feed or related tools.",
      );
    }
  } else if (status === "DECLINED") {
    recommendedStepIndex = null;
    honestyNotes.push(
      "This revision was declined by the customer on the portal. Locked records are kept for audit; it is not signable.",
    );
    likelyNextSteps.push(
      "Review the decline reason in revision history or the signature panel, then create a new draft if you need a revised proposal.",
    );
  } else if (status === "VOID") {
    recommendedStepIndex = null;
    honestyNotes.push("This revision was voided (withdrawn). Locked records are kept for audit; it is not signable.");
    likelyNextSteps.push("Use revision history: create or open a non-void draft to continue commercial work.");
  } else if (status === "SUPERSEDED") {
    recommendedStepIndex = null;
    honestyNotes.push(
      "This revision was superseded when a newer version was sent. It is not the active customer proposal.",
    );
    likelyNextSteps.push("Open the newest SENT or draft row in revision history for current work.");
  } else {
    likelyNextSteps.push("This status is unexpected here — contact support or check revision history.");
  }

  return {
    kind: "head",
    versionNumber: head.versionNumber,
    quoteVersionId: head.id,
    status,
    checklist,
    likelyNextSteps,
    recommendedStepIndex,
    recommendedStepTitle: workspaceRecommendedStepTitle(recommendedStepIndex),
    honestyNotes,
  };
}
