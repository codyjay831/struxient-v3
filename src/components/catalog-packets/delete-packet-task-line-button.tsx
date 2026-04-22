"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  scopePacketId: string;
  scopePacketRevisionId: string;
  packetTaskLineId: string;
  lineKey: string;
};

export function DeletePacketTaskLineButton({ scopePacketId, scopePacketRevisionId, packetTaskLineId, lineKey }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (!window.confirm(`Delete line “${lineKey}”?`)) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/scope-packets/${encodeURIComponent(scopePacketId)}/revisions/${encodeURIComponent(scopePacketRevisionId)}/task-lines/${encodeURIComponent(packetTaskLineId)}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        window.alert(j.error?.message ?? `HTTP ${res.status}`);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void onDelete()}
      className="rounded border border-rose-900/50 bg-rose-950/30 px-2 py-1 text-[11px] font-medium text-rose-300 hover:bg-rose-950/50 disabled:opacity-50"
    >
      {busy ? "…" : "Delete"}
    </button>
  );
}
