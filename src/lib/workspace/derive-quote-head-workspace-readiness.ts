/**
 * Head-version workspace readiness: pure derivation from workspace/history fields only.
 * Does not call scope/lifecycle/freeze APIs — avoids duplicate truth and hidden drift.
 */

/** Subset of `QuoteVersionHistoryItemDto` — keep in sync manually (no server import here). */
export type QuoteHeadReadinessInput = {
  id: string;
  versionNumber: number;
  status: "DRAFT" | "SENT" | "SIGNED" | string;
  hasPinnedWorkflow: boolean;
  hasFrozenArtifacts: boolean;
  hasActivation: boolean;
  proposalGroupCount: number;
  sentAt: string | null;
  signedAt: string | null;
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
 * Send “readiness” for drafts is intentionally partial: compose errors / empty plan are only knowable via compose-preview + send-time compose.
 */
export function deriveQuoteHeadWorkspaceReadiness(head: QuoteHeadReadinessInput | null): QuoteHeadWorkspaceReadiness {
  if (!head) {
    return { kind: "no_versions" };
  }

  const { status } = head;
  const checklist: ReadinessChecklistItem[] = [
    checklistItem(
      "pin",
      "Pinned workflow version",
      head.hasPinnedWorkflow ? "yes" : "no",
      status === "DRAFT" ?
        head.hasPinnedWorkflow ?
          "Required before send; satisfied for static checks only."
        : "Missing — send is blocked until PATCH sets pinnedWorkflowVersionId."
      : status === "SENT" || status === "SIGNED" ?
        head.hasPinnedWorkflow ?
          "Expected after a normal send (snapshots tied to a workflow version)."
        : "Unusual for sent/signed — verify data or history."
      : undefined,
    ),
    checklistItem(
      "frozen",
      "Frozen plan/package snapshot hashes recorded",
      head.hasFrozenArtifacts ? "yes" : "no",
      status === "DRAFT" ?
        "Usually false while still draft; send records hashes."
      : "After send, expect yes; use freeze read for detail.",
    ),
    checklistItem(
      "activation",
      "Activation row exists",
      head.hasActivation ? "yes" : "no",
      status === "DRAFT" || status === "SENT" ?
        "Activation follows sign in the normal pipeline (not expected on draft/sent-only)."
      : status === "SIGNED" ?
        head.hasActivation ?
          "Post-activate — use lifecycle + runtime reads as appropriate."
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

  const likelyNextSteps: string[] = [];
  let recommendedStepIndex: number | null = null;
  const honestyNotes: string[] = [
    "This summary uses workspace/history fields only. It does not embed scope, lifecycle, or freeze JSON.",
  ];

  if (status === "DRAFT") {
    honestyNotes.push(
      "Whether send will succeed is not fully knowable here: send re-runs compose server-side; run compose-preview for validation and staleness token.",
    );
    if (!head.hasPinnedWorkflow) {
      recommendedStepIndex = 2; // Select workflow
      likelyNextSteps.push(
        "Set pinned workflow: PATCH /api/quote-versions/{id} with pinnedWorkflowVersionId (office_mutate).",
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
