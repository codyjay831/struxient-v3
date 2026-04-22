"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CreateScopePacketForm() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [packetKey, setPacketKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const body: { displayName: string; packetKey?: string } = { displayName: displayName.trim() };
      const pk = packetKey.trim();
      if (pk) body.packetKey = pk;

      const res = await fetch("/api/scope-packets", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: { message?: string };
        data?: { scopePacket?: { id: string }; scopePacketRevision?: { id: string } };
      };
      if (!res.ok) {
        setMsg({ kind: "err", text: j.error?.message ?? `HTTP ${res.status}` });
        return;
      }
      const sp = j.data?.scopePacket?.id;
      const rev = j.data?.scopePacketRevision?.id;
      if (!sp || !rev) {
        setMsg({ kind: "err", text: "Unexpected response shape." });
        return;
      }
      router.replace(`/library/packets/${encodeURIComponent(sp)}/revisions/${encodeURIComponent(rev)}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(ev) => void onSubmit(ev)} className="max-w-lg space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/20 p-6">
      <div>
        <label className="block text-xs font-medium text-zinc-400">Display name</label>
        <input
          type="text"
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          disabled={busy}
          placeholder="e.g. Standard rough-in packet"
          className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 disabled:opacity-50"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-400">
          Packet key <span className="text-zinc-600">(optional)</span>
        </label>
        <input
          type="text"
          value={packetKey}
          onChange={(e) => setPacketKey(e.target.value)}
          disabled={busy}
          placeholder="Lowercase slug; leave blank to derive from name"
          className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 disabled:opacity-50"
        />
        <p className="mt-1 text-[11px] text-zinc-500 leading-relaxed">
          Keys must be unique per tenant (2–80 chars, lowercase letters, digits, hyphens). If omitted, the server picks a
          unique slug from the display name.
        </p>
      </div>
      <button
        type="submit"
        disabled={busy || !displayName.trim()}
        className="rounded bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
      >
        {busy ? "Creating…" : "Create packet"}
      </button>
      {msg ? (
        <p className={`text-sm ${msg.kind === "ok" ? "text-emerald-400/90" : "text-rose-400/90"}`} role="status">
          {msg.text}
        </p>
      ) : null}
    </form>
  );
}
