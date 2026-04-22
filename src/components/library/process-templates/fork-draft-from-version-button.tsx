"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { InternalActionResult } from "@/components/internal/internal-action-result";

type Props = {
  templateId: string;
  sourceWorkflowVersionId: string;
  /** e.g. "v2 (PUBLISHED)" for button label context */
  versionSummary: string;
  canOfficeMutate: boolean;
};

/**
 * Creates the next DRAFT by forking snapshot from this version via
 * `POST /api/workflow-templates/[templateId]/versions` with `{ forkFromWorkflowVersionId }`.
 */
export function ProcessTemplatesForkDraftFromVersionButton({
  templateId,
  sourceWorkflowVersionId,
  versionSummary,
  canOfficeMutate,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    title: string;
    message?: string;
    technicalDetails?: string;
  } | null>(null);

  if (!canOfficeMutate) {
    return null;
  }

  async function onClick() {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/workflow-templates/${encodeURIComponent(templateId)}/versions`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forkFromWorkflowVersionId: sourceWorkflowVersionId }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        data?: { workflowVersion?: { id: string } };
        error?: { code?: string; message?: string };
      };
      if (!res.ok) {
        const code = body.error?.code ?? "ERROR";
        const isDraftExists = code === "WORKFLOW_TEMPLATE_DRAFT_VERSION_EXISTS";
        const isForkInvalid = code === "WORKFLOW_VERSION_FORK_SOURCE_INVALID";
        setFeedback({
          kind: "error",
          title: isDraftExists
            ? "Draft already exists"
            : isForkInvalid
              ? "Cannot fork from this version"
              : "Fork draft failed",
          message:
            body.error?.message ??
            (isDraftExists
              ? "Publish or delete the existing draft first — only one draft per template."
              : `HTTP ${res.status}`),
          technicalDetails: code,
        });
        return;
      }
      const vid = body.data?.workflowVersion?.id;
      setFeedback({ kind: "success", title: "Draft created from snapshot", message: "Opening draft editor…" });
      if (vid) {
        router.push(`/library/process-templates/${encodeURIComponent(templateId)}/versions/${encodeURIComponent(vid)}`);
        router.refresh();
      } else {
        router.refresh();
      }
    } catch {
      setFeedback({
        kind: "error",
        title: "Fork draft failed",
        message: "Network error.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 px-4 py-3">
      <p className="text-sm text-zinc-400 mb-3">
        This read-only version ({versionSummary}) can be copied into a new draft. The source row is not modified.
      </p>
      <button
        type="button"
        onClick={() => void onClick()}
        disabled={busy}
        className="rounded-md border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-100 hover:bg-zinc-700 disabled:opacity-50"
      >
        {busy ? "Forking…" : "Fork new draft from this version"}
      </button>
      {feedback && (
        <div className="mt-3 max-w-lg">
          <InternalActionResult
            kind={feedback.kind}
            title={feedback.title}
            message={feedback.message}
            technicalDetails={feedback.technicalDetails}
          />
        </div>
      )}
    </div>
  );
}
