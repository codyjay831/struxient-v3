"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { InternalActionResult } from "@/components/internal/internal-action-result";

type Props = {
  workflowVersionId: string;
  templateId: string;
  initialEditorText: string;
};

/**
 * Coarse draft-only snapshot editor: JSON textarea + save (PUT) + publish (POST).
 * Not a workflow design tool — internal authoring until a structured editor exists.
 */
export function ProcessTemplatesDraftSnapshotEditor({ workflowVersionId, templateId, initialEditorText }: Props) {
  const router = useRouter();
  const [text, setText] = useState(initialEditorText);
  const [busySave, setBusySave] = useState(false);
  const [busyPublish, setBusyPublish] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    title: string;
    message?: string;
    technicalDetails?: string;
  } | null>(null);

  async function saveSnapshot() {
    setBusySave(true);
    setFeedback(null);
    let snapshotJson: unknown;
    try {
      snapshotJson = JSON.parse(text) as unknown;
    } catch {
      setFeedback({
        kind: "error",
        title: "Invalid JSON",
        message: "Fix JSON syntax before saving. The snapshot must be a single JSON object.",
      });
      setBusySave(false);
      return;
    }
    try {
      const res = await fetch(`/api/workflow-versions/${encodeURIComponent(workflowVersionId)}/snapshot`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshotJson }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: { code?: string; message?: string };
      };
      if (!res.ok) {
        setFeedback({
          kind: "error",
          title: "Save failed",
          message: body.error?.message ?? `HTTP ${res.status}`,
          technicalDetails: body.error?.code,
        });
        return;
      }
      setFeedback({ kind: "success", title: "Snapshot saved", message: "Draft updated on the server." });
      router.refresh();
    } catch {
      setFeedback({ kind: "error", title: "Save failed", message: "Network error." });
    } finally {
      setBusySave(false);
    }
  }

  async function publish() {
    setBusyPublish(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/workflow-versions/${encodeURIComponent(workflowVersionId)}/publish`, {
        method: "POST",
        credentials: "include",
      });
      const body = (await res.json().catch(() => ({}))) as {
        data?: { publish?: { demotedSiblingCount?: number } };
        error?: { code?: string; message?: string };
      };
      if (!res.ok) {
        setFeedback({
          kind: "error",
          title: "Publish failed",
          message: body.error?.message ?? `HTTP ${res.status}`,
          technicalDetails: body.error?.code,
        });
        return;
      }
      const demoted = body.data?.publish?.demotedSiblingCount ?? 0;
      setFeedback({
        kind: "success",
        title: "Published",
        message:
          demoted > 0
            ? `Prior published version demoted (superseded). ${demoted} sibling row(s) updated.`
            : "This version is now published and can be pinned on quotes.",
      });
      router.push(`/library/process-templates/${encodeURIComponent(templateId)}`);
      router.refresh();
    } catch {
      setFeedback({ kind: "error", title: "Publish failed", message: "Network error." });
    } finally {
      setBusyPublish(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-900/40 bg-amber-950/10 px-4 py-3 text-xs text-amber-200/90">
        <strong className="text-amber-100">Draft-only internal authoring.</strong> Paste/edit the whole{" "}
        <span className="font-mono">snapshotJson</span> object. Gates, routing, and structured node authoring are{" "}
        <strong>not</strong> available here yet. Publish requires at least one node with unique string{" "}
        <span className="font-mono">id</span> values (server-validated).
      </div>
      <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
        Snapshot JSON (entire object)
      </label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        className="w-full min-h-[280px] rounded-md border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs text-zinc-200 leading-relaxed"
        disabled={busySave || busyPublish}
      />
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void saveSnapshot()}
          disabled={busySave || busyPublish}
          className="rounded-md border border-zinc-600 bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-100 hover:bg-zinc-700 disabled:opacity-50"
        >
          {busySave ? "Saving…" : "Save snapshot"}
        </button>
        <button
          type="button"
          onClick={() => void publish()}
          disabled={busySave || busyPublish}
          className="rounded-md bg-emerald-800 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {busyPublish ? "Publishing…" : "Publish version"}
        </button>
      </div>
      {feedback && (
        <InternalActionResult
          kind={feedback.kind}
          title={feedback.title}
          message={feedback.message}
          technicalDetails={feedback.technicalDetails}
        />
      )}
    </div>
  );
}
