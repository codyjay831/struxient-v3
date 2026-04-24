"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { QuoteVersionHistoryItemDto } from "@/server/slice1/reads/quote-version-history-reads";

type Props = {
  quoteVersionId: string;
  status: QuoteVersionHistoryItemDto["status"];
  hasActivation: boolean;
  versions: Pick<QuoteVersionHistoryItemDto, "id" | "status">[];
  canOfficeMutate: boolean;
};

export function QuoteVersionVoidControl({ quoteVersionId, status, hasActivation, versions, canOfficeMutate }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const otherNonVoid = versions.some((v) => v.id !== quoteVersionId && v.status !== "VOID");
  const canVoidSent = status === "SENT" && !hasActivation;
  const canVoidDeclined = status === "DECLINED" && !hasActivation;
  const canVoidDraft = status === "DRAFT" && otherNonVoid;
  const show = canOfficeMutate && (canVoidSent || canVoidDeclined || canVoidDraft);

  if (!show) {
    return null;
  }

  async function submit() {
    const r = reason.trim();
    if (!r) {
      setErr("A void reason is required.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/quote-versions/${encodeURIComponent(quoteVersionId)}/void`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voidReason: r }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } };
      if (!res.ok) {
        setErr(body.error?.message ?? body.error?.code ?? `Request failed (${String(res.status)})`);
        return;
      }
      setOpen(false);
      setReason("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-center gap-1">
      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setErr(null);
          }}
          className="rounded border border-rose-900/50 bg-rose-950/30 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-rose-200 hover:bg-rose-900/40"
        >
          Void
        </button>
      ) : (
        <div className="flex min-w-[200px] max-w-[260px] flex-col gap-1 rounded border border-rose-900/40 bg-zinc-950 p-2 text-left">
          <label className="text-[10px] text-rose-200/90">
            Reason (audit)
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              disabled={busy}
              className="mt-0.5 w-full resize-none rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 text-[10px] text-zinc-100"
              placeholder="Why this revision is withdrawn…"
            />
          </label>
          {err ? <p className="text-[10px] text-rose-400">{err}</p> : null}
          <div className="flex justify-end gap-1">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                setErr(null);
              }}
              className="rounded px-2 py-0.5 text-[10px] text-zinc-500 hover:text-zinc-300"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void submit()}
              className="rounded bg-rose-900/80 px-2 py-0.5 text-[10px] font-medium text-rose-50 hover:bg-rose-800"
            >
              {busy ? "…" : "Confirm void"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
