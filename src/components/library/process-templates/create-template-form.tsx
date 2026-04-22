"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { InternalActionResult } from "@/components/internal/internal-action-result";

type Props = {
  canOfficeMutate: boolean;
};

/**
 * Minimal template create — calls `POST /api/workflow-templates` (office_mutate).
 */
export function ProcessTemplatesCreateForm({ canOfficeMutate }: Props) {
  const router = useRouter();
  const [templateKey, setTemplateKey] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    title: string;
    message?: string;
    technicalDetails?: string;
  } | null>(null);

  if (!canOfficeMutate) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 px-4 py-3 text-xs text-zinc-500">
        Your role cannot create templates. Office admins can add process templates here.
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/workflow-templates", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateKey: templateKey.trim(),
          displayName: displayName.trim(),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        data?: { template?: { id: string } };
        error?: { code?: string; message?: string };
      };
      if (!res.ok) {
        setFeedback({
          kind: "error",
          title: "Create failed",
          message: body.error?.message ?? `HTTP ${res.status}`,
          technicalDetails: body.error?.code,
        });
        return;
      }
      const id = body.data?.template?.id;
      setFeedback({
        kind: "success",
        title: "Template created",
        message: id ? "Opening template detail…" : "Refresh the list to see it.",
      });
      if (id) {
        router.push(`/library/process-templates/${id}`);
        router.refresh();
      } else {
        router.refresh();
      }
    } catch {
      setFeedback({
        kind: "error",
        title: "Create failed",
        message: "Network error while creating the template.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-6">
      <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wide">New process template</h2>
      <p className="text-xs text-zinc-500 mt-1 mb-4">
        Defines the node skeleton quotes pin for compose. This is catalog-style authoring — not a graph
        designer yet. Use a stable <span className="font-mono text-zinc-400">templateKey</span> (unique per tenant).
      </p>
      <form onSubmit={onSubmit} className="space-y-4 max-w-md">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
            Template key
          </label>
          <input
            value={templateKey}
            onChange={(e) => setTemplateKey(e.target.value)}
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 font-mono"
            placeholder="e.g. standard-roof-v1"
            required
            disabled={busy}
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
            Display name
          </label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200"
            placeholder="e.g. Standard roof"
            required
            disabled={busy}
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-sky-700 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-600 disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create template"}
        </button>
      </form>
      {feedback && (
        <div className="mt-4">
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
