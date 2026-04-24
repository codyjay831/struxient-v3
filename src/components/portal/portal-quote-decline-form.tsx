"use client";

import { useState } from "react";

type Props = { shareToken: string };

export function PortalQuoteDeclineForm({ shareToken }: Props) {
  const [declineReason, setDeclineReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBanner(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/portal/quotes/${encodeURIComponent(shareToken)}/decline`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ declineReason }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        data?: { portalDeclinedAt?: string };
        error?: { message?: string; code?: string };
      };
      if (!res.ok) {
        setBanner({
          kind: "err",
          text: body.error?.message ?? body.error?.code ?? `Request failed (${res.status})`,
        });
        return;
      }
      setBanner({
        kind: "ok",
        text: "Your decision has been recorded. You can keep this page for your records, or close when you are done.",
      });
    } finally {
      setBusy(false);
    }
  }

  if (banner?.kind === "ok") {
    return (
      <section className="mt-8 rounded-lg border border-orange-900/40 bg-orange-950/20 p-5 text-sm text-orange-100">
        {banner.text}
      </section>
    );
  }

  return (
    <form onSubmit={(ev) => void onSubmit(ev)} className="mt-8 space-y-4 rounded-lg border border-zinc-800 bg-zinc-900/40 p-5">
      <h2 className="text-sm font-semibold text-zinc-100">Decline this proposal</h2>
      <p className="text-xs text-zinc-500">
        If you do not wish to accept this quote as presented, submit a short reason below. Your office contact will see
        this outcome in Struxient without needing a separate email or text thread.
      </p>
      <label className="block text-xs">
        <span className="text-zinc-400">Reason (required)</span>
        <textarea
          required
          value={declineReason}
          onChange={(e) => setDeclineReason(e.target.value)}
          disabled={busy}
          rows={4}
          className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-2 text-sm text-zinc-100"
          placeholder="e.g. Timing, scope mismatch, pricing — enough context for your rep to follow up."
        />
      </label>
      {banner?.kind === "err" ? <p className="text-xs text-rose-400">{banner.text}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="rounded border border-orange-900/60 bg-orange-950/40 px-4 py-2 text-xs font-medium text-orange-100 hover:bg-orange-900/45 disabled:opacity-50"
      >
        {busy ? "Submitting…" : "Submit decline"}
      </button>
    </form>
  );
}
