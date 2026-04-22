"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  scopePacketId: string;
  scopePacketRevisionId: string;
};

export function AddEmbeddedPacketTaskLineForm({ scopePacketId, scopePacketRevisionId }: Props) {
  const router = useRouter();
  const [lineKey, setLineKey] = useState("");
  const [targetNodeKey, setTargetNodeKey] = useState("");
  const [title, setTitle] = useState("");
  const [taskKind, setTaskKind] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const body: Record<string, unknown> = {
        lineKey: lineKey.trim(),
        targetNodeKey: targetNodeKey.trim(),
        title: title.trim(),
      };
      if (taskKind.trim()) body.taskKind = taskKind.trim();

      const res = await fetch(
        `/api/scope-packets/${encodeURIComponent(scopePacketId)}/revisions/${encodeURIComponent(scopePacketRevisionId)}/task-lines`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!res.ok) {
        setMsg({ kind: "err", text: j.error?.message ?? `HTTP ${res.status}` });
        return;
      }
      setLineKey("");
      setTargetNodeKey("");
      setTitle("");
      setTaskKind("");
      setMsg({ kind: "ok", text: "Line added." });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(ev) => void onSubmit(ev)}
      className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4 space-y-3"
    >
      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Add embedded line</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-[11px] font-medium text-zinc-500">lineKey</label>
          <input
            required
            value={lineKey}
            onChange={(e) => setLineKey(e.target.value)}
            disabled={busy}
            placeholder="rough-in"
            className="mt-0.5 w-full rounded border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-zinc-500">targetNodeKey</label>
          <input
            required
            value={targetNodeKey}
            onChange={(e) => setTargetNodeKey(e.target.value)}
            disabled={busy}
            placeholder="install-node"
            className="mt-0.5 w-full rounded border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
          />
        </div>
      </div>
      <div>
        <label className="block text-[11px] font-medium text-zinc-500">Title (embedded payload)</label>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={busy}
          placeholder="Rough-in labor"
          className="mt-0.5 w-full rounded border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
        />
      </div>
      <div>
        <label className="block text-[11px] font-medium text-zinc-500">taskKind (optional)</label>
        <input
          value={taskKind}
          onChange={(e) => setTaskKind(e.target.value)}
          disabled={busy}
          placeholder="INSTALL"
          className="mt-0.5 w-full rounded border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
        />
      </div>
      <button
        type="submit"
        disabled={busy || !lineKey.trim() || !targetNodeKey.trim() || !title.trim()}
        className="rounded bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
      >
        {busy ? "Adding…" : "Add line"}
      </button>
      {msg ? (
        <p className={`text-xs ${msg.kind === "ok" ? "text-emerald-400/90" : "text-rose-400/90"}`}>{msg.text}</p>
      ) : null}
    </form>
  );
}
