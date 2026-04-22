"use client";

import { useState } from "react";

type Props = { shareToken: string };

export function PortalQuoteSignForm({ shareToken }: Props) {
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBanner(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/portal/quotes/${encodeURIComponent(shareToken)}/sign`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ signerName, signerEmail, acceptTerms }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        data?: { signedAt?: string };
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
        text: "Your acceptance has been recorded. Thank you — you can keep this page for your records.",
      });
    } finally {
      setBusy(false);
    }
  }

  if (banner?.kind === "ok") {
    return (
      <section className="mt-8 rounded-lg border border-emerald-900/40 bg-emerald-950/20 p-5 text-sm text-emerald-100">
        {banner.text}
      </section>
    );
  }

  return (
    <form onSubmit={(ev) => void onSubmit(ev)} className="mt-8 space-y-4 rounded-lg border border-zinc-800 bg-zinc-900/40 p-5">
      <h2 className="text-sm font-semibold text-zinc-100">Sign to accept this quote</h2>
      <p className="text-xs text-zinc-500">
        By submitting, you agree this constitutes your electronic acceptance of the proposal as presented
        above (frozen at send). Your name and email are stored with the signature record.
      </p>
      <label className="block text-xs">
        <span className="text-zinc-400">Full name</span>
        <input
          required
          value={signerName}
          onChange={(e) => setSignerName(e.target.value)}
          disabled={busy}
          className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-2 text-sm text-zinc-100"
        />
      </label>
      <label className="block text-xs">
        <span className="text-zinc-400">Email</span>
        <input
          required
          type="email"
          value={signerEmail}
          onChange={(e) => setSignerEmail(e.target.value)}
          disabled={busy}
          className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-2 text-sm text-zinc-100"
        />
      </label>
      <label className="flex items-start gap-2 text-xs text-zinc-300">
        <input
          type="checkbox"
          checked={acceptTerms}
          onChange={(e) => setAcceptTerms(e.target.checked)}
          disabled={busy}
          className="mt-0.5"
        />
        <span>I have reviewed this quote and agree to accept it as shown.</span>
      </label>
      {banner ? (
        <p
          className={`text-xs rounded px-2 py-1.5 ${
            banner.kind === "ok" ? "bg-emerald-950/40 text-emerald-200" : "bg-red-950/40 text-red-200"
          }`}
        >
          {banner.text}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy || !acceptTerms}
        className="rounded bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-50"
      >
        {busy ? "Submitting…" : "Submit acceptance"}
      </button>
    </form>
  );
}
