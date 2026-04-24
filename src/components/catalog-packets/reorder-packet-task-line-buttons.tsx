"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  scopePacketId: string;
  scopePacketRevisionId: string;
  packetTaskLineId: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
};

export function ReorderPacketTaskLineButtons({
  scopePacketId,
  scopePacketRevisionId,
  packetTaskLineId,
  canMoveUp,
  canMoveDown,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<"up" | "down" | null>(null);

  async function move(direction: "up" | "down") {
    setBusy(direction);
    try {
      const res = await fetch(
        `/api/scope-packets/${encodeURIComponent(scopePacketId)}/revisions/${encodeURIComponent(scopePacketRevisionId)}/task-lines/${encodeURIComponent(packetTaskLineId)}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ direction }),
        },
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        window.alert(j.error?.message ?? `HTTP ${res.status}`);
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <span className="inline-flex gap-1">
      <button
        type="button"
        title="Move up in list order"
        disabled={!canMoveUp || busy !== null}
        onClick={() => void move("up")}
        className="rounded border border-zinc-700 bg-zinc-950/60 px-1.5 py-0.5 text-[11px] font-medium text-zinc-300 hover:bg-zinc-900 disabled:opacity-40"
      >
        {busy === "up" ? "…" : "↑"}
      </button>
      <button
        type="button"
        title="Move down in list order"
        disabled={!canMoveDown || busy !== null}
        onClick={() => void move("down")}
        className="rounded border border-zinc-700 bg-zinc-950/60 px-1.5 py-0.5 text-[11px] font-medium text-zinc-300 hover:bg-zinc-900 disabled:opacity-40"
      >
        {busy === "down" ? "…" : "↓"}
      </button>
    </span>
  );
}
