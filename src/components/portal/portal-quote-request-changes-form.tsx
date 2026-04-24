"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = { shareToken: string };

export function PortalQuoteRequestChangesForm({ shareToken }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBanner(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/portal/quotes/${encodeURIComponent(shareToken)}/request-changes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        data?: { portalChangeRequestedAt?: string; idempotentReplay?: boolean };
        error?: { message?: string; code?: string };
      };
      if (!res.ok) {
        setBanner({
          kind: "err",
          text: body.error?.message ?? body.error?.code ?? `Request failed (${res.status})`,
        });
        return;
      }
      const replay = body.data?.idempotentReplay === true;
      setBanner({
        kind: "ok",
        text: replay
          ? "Your change request is already on file — nothing new was submitted."
          : "Your change request has been sent to the project office. You can still sign above if this version already works for you, or wait for a revised proposal.",
      });
      if (!replay) {
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(ev) => void onSubmit(ev)} className="mt-6 space-y-3 rounded-lg border border-amber-900/35 bg-amber-950/15 p-5">
      <h2 className="text-sm font-semibold text-amber-100/95">Request changes</h2>
      <p className="text-xs text-amber-200/70">
        Use this if you need edits to the scope or proposal before accepting. This does not decline the quote and
        does not count as a signature — the office will review your message.
      </p>
      <label className="block text-xs">
        <span className="text-amber-200/80">What would you like adjusted?</span>
        <textarea
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={busy}
          rows={4}
          className="mt-1 w-full rounded border border-amber-900/40 bg-zinc-950 px-2 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
          placeholder="e.g. Please remove gutters from this revision and adjust the start window."
        />
      </label>
      {banner ? (
        <p
          className={`text-xs rounded px-2 py-1.5 ${
            banner.kind === "ok" ? "bg-emerald-950/35 text-emerald-100/95" : "bg-red-950/40 text-red-200"
          }`}
        >
          {banner.text}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy || !message.trim()}
        className="rounded border border-amber-800/50 bg-amber-950/40 px-4 py-2 text-sm font-medium text-amber-50 hover:bg-amber-900/35 disabled:opacity-50"
      >
        {busy ? "Submitting…" : "Submit change request"}
      </button>
    </form>
  );
}
