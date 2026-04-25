"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Confirm-then-delete button island for a `LineItemPreset` (Phase 2 / Slice 3).
 * Lives next to the edit form on the detail page so server data can stay
 * server-rendered while the destructive action remains a client interaction.
 *
 * Deleting a preset never affects existing `QuoteLineItem` rows — those snapshot
 * commercial values at create time (Slice 2 prefill behavior).
 */
export function DeleteLineItemPresetButton({
  lineItemPresetId,
  displayName,
}: {
  lineItemPresetId: string;
  displayName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onDelete() {
    const ok = window.confirm(
      `Delete saved line item "${displayName}"? Existing quote line items already created from this preset are unaffected.`,
    );
    if (!ok) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/line-item-presets/${encodeURIComponent(lineItemPresetId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        setErr(j.error?.message ?? `HTTP ${res.status}`);
        return;
      }
      router.replace("/library/line-item-presets");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void onDelete()}
        disabled={busy}
        className="rounded border border-rose-800/60 bg-rose-950/30 px-4 py-2 text-sm font-medium text-rose-300 hover:bg-rose-900/40 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Deleting…" : "Delete preset"}
      </button>
      {err ? (
        <p className="text-sm text-rose-400/90" role="status">
          {err}
        </p>
      ) : null}
    </div>
  );
}
