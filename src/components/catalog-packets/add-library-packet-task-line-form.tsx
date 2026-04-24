"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLibraryPacketComposeHintWorkflowVersionId } from "@/components/catalog-packets/library-packet-compose-hint-workflow-provider";
import { TargetNodePicker } from "@/components/quote-scope/target-node-picker";

export type PublishedTaskDefinitionOption = {
  id: string;
  taskKey: string;
  displayName: string;
};

type Props = {
  scopePacketId: string;
  scopePacketRevisionId: string;
  publishedTaskDefinitions: PublishedTaskDefinitionOption[];
};

export function AddLibraryPacketTaskLineForm({
  scopePacketId,
  scopePacketRevisionId,
  publishedTaskDefinitions,
}: Props) {
  const router = useRouter();
  const hintWorkflowVersionId = useLibraryPacketComposeHintWorkflowVersionId();
  const [lineKey, setLineKey] = useState("");
  const [targetNodeKey, setTargetNodeKey] = useState("");
  const [taskDefinitionId, setTaskDefinitionId] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(
        `/api/scope-packets/${encodeURIComponent(scopePacketId)}/revisions/${encodeURIComponent(scopePacketRevisionId)}/task-lines`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lineKey: lineKey.trim(),
            targetNodeKey: targetNodeKey.trim(),
            taskDefinitionId: taskDefinitionId.trim(),
          }),
        },
      );
      const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!res.ok) {
        setMsg({ kind: "err", text: j.error?.message ?? `HTTP ${res.status}` });
        return;
      }
      setLineKey("");
      setTargetNodeKey("");
      setTaskDefinitionId("");
      setMsg({ kind: "ok", text: "Library line added." });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (publishedTaskDefinitions.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4 text-sm text-zinc-500">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Add library line</h3>
        <p className="mt-2 text-xs leading-relaxed">
          No published task definitions in this tenant. Publish a catalog task definition first, then you can
          reference it here.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(ev) => void onSubmit(ev)}
      className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4 space-y-3"
    >
      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Add library line</h3>
      <p className="text-[11px] leading-relaxed text-zinc-500">
        Picks a <span className="text-zinc-400">PUBLISHED</span> catalog task definition. Requires{" "}
        <code className="text-zinc-400">lineKey</code> and <code className="text-zinc-400">targetNodeKey</code> for
        compose compatibility (same as embedded lines).
      </p>
      <div>
        <label className="block text-[11px] font-medium text-zinc-500">Task definition</label>
        <select
          required
          value={taskDefinitionId}
          onChange={(e) => setTaskDefinitionId(e.target.value)}
          disabled={busy}
          className="mt-0.5 w-full rounded border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
        >
          <option value="">Select…</option>
          {publishedTaskDefinitions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.displayName} ({d.taskKey})
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-[11px] font-medium text-zinc-500">lineKey</label>
          <input
            required
            value={lineKey}
            onChange={(e) => setLineKey(e.target.value)}
            disabled={busy}
            placeholder="rough-in-lib"
            className="mt-0.5 w-full rounded border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
          />
        </div>
        <div>
          <span className="block text-[11px] font-medium text-zinc-500">targetNodeKey</span>
          <div className="mt-0.5">
            <TargetNodePicker
              workflowVersionIdForNodeKeys={hintWorkflowVersionId}
              value={targetNodeKey}
              disabled={busy}
              onChange={setTargetNodeKey}
              copyVariant="catalogLibraryHint"
            />
          </div>
        </div>
      </div>
      <button
        type="submit"
        disabled={busy || !lineKey.trim() || !targetNodeKey.trim() || !taskDefinitionId}
        className="rounded bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
      >
        {busy ? "Adding…" : "Add library line"}
      </button>
      {msg ? (
        <p className={`text-xs ${msg.kind === "ok" ? "text-emerald-400/90" : "text-rose-400/90"}`}>{msg.text}</p>
      ) : null}
    </form>
  );
}
