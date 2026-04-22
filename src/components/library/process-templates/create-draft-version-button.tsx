"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { InternalActionResult } from "@/components/internal/internal-action-result";

type Props = {
  templateId: string;
  canOfficeMutate: boolean;
};

/**
 * Creates the next DRAFT version via `POST /api/workflow-templates/[templateId]/versions`.
 */
export function ProcessTemplatesCreateDraftButton({ templateId, canOfficeMutate }: Props) {
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
        body: "{}",
      });
      const body = (await res.json().catch(() => ({}))) as {
        data?: { workflowVersion?: { id: string } };
        error?: { code?: string; message?: string; context?: unknown };
      };
      if (!res.ok) {
        const code = body.error?.code ?? "ERROR";
        const isDraftExists = code === "WORKFLOW_TEMPLATE_DRAFT_VERSION_EXISTS";
        setFeedback({
          kind: "error",
          title: isDraftExists ? "Draft already exists" : "Create draft failed",
          message:
            body.error?.message ??
            (isDraftExists
              ? "Publish or edit the existing draft version first — only one draft per template."
              : `HTTP ${res.status}`),
          technicalDetails: code,
        });
        return;
      }
      const vid = body.data?.workflowVersion?.id;
      setFeedback({ kind: "success", title: "Draft created", message: "Opening draft editor…" });
      if (vid) {
        router.push(`/library/process-templates/${encodeURIComponent(templateId)}/versions/${encodeURIComponent(vid)}`);
        router.refresh();
      } else {
        router.refresh();
      }
    } catch {
      setFeedback({
        kind: "error",
        title: "Create draft failed",
        message: "Network error.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void onClick()}
        disabled={busy}
        className="rounded-md bg-sky-700 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-600 disabled:opacity-50"
      >
        {busy ? "Creating…" : "Create draft version"}
      </button>
      <p className="text-[10px] text-zinc-500 mt-2 max-w-md">
        Only one draft at a time. New drafts start with an empty <span className="font-mono">nodes</span> array — add
        nodes in JSON before publish (publish requires ≥1 node with unique string ids). To copy a published or
        superseded snapshot instead, open that version and use <span className="text-zinc-400">Fork new draft</span>.
      </p>
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
