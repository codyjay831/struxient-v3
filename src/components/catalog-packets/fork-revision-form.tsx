"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Smallest safe interim fork affordance for a PUBLISHED `ScopePacketRevision`.
 * Surfaced on the dev catalog revision detail page; visible only when the
 * revision is PUBLISHED.
 *
 * Calls POST /api/quote-versions/[quoteVersionId]/local-packets/fork-from-revision,
 * then navigates the user to the target quote-scope page so they can edit the
 * new local copy.
 *
 * Dev-only shape: takes a target `QuoteVersion` id as a free-text input. A
 * rich quote picker UX is intentionally out of scope for this slice.
 *
 * Canon refs:
 *   - docs/canon/05-packet-canon.md §100-101 (mandatory fork on task mutation)
 *   - docs/bridge-decisions/03-packet-fork-promotion-decision.md
 */
export function ForkRevisionForm({
  scopePacketId,
  scopePacketRevisionId,
  revisionNumber,
  defaultDisplayName,
}: {
  scopePacketId: string;
  scopePacketRevisionId: string;
  revisionNumber: number;
  defaultDisplayName: string;
}) {
  const router = useRouter();
  const [quoteVersionId, setQuoteVersionId] = useState("");
  const [displayNameOverride, setDisplayNameOverride] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    quoteLocalPacketId: string;
    quoteVersionId: string;
  } | null>(null);

  async function handleFork() {
    if (busy) return;
    const trimmedQv = quoteVersionId.trim();
    if (!trimmedQv) {
      setError("Target quote-version id is required.");
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(
        `/api/quote-versions/${encodeURIComponent(trimmedQv)}/local-packets/fork-from-revision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scopePacketRevisionId,
            displayName: displayNameOverride.trim() || undefined,
          }),
        },
      );
      if (!res.ok) {
        let code = `HTTP_${res.status}`;
        let message = `Fork failed (HTTP ${res.status}).`;
        try {
          const j = (await res.json()) as { error?: { code?: string; message?: string } };
          if (j.error?.code) code = j.error.code;
          if (j.error?.message) message = j.error.message;
        } catch {
          // body wasn't JSON; fall through with the HTTP status only.
        }
        setError(`${code}: ${message}`);
        setBusy(false);
        return;
      }
      const j = (await res.json()) as { data?: { id: string; quoteVersionId: string } };
      if (j.data?.id && j.data?.quoteVersionId) {
        setSuccess({
          quoteLocalPacketId: j.data.id,
          quoteVersionId: j.data.quoteVersionId,
        });
      }
      router.refresh();
      setBusy(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fork failed (network error).");
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-lg border border-sky-800/60 bg-sky-950/20 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-sky-300">
        Fork to quote-local copy
      </h2>
      <p className="mt-2 text-[11px] leading-relaxed text-sky-200/80">
        Canon §100-101 requires task mutation on a library packet to fork into a{" "}
        <code className="text-sky-100">QuoteLocalPacket</code> on a target quote
        version. This action deep-copies every <code className="text-sky-100">PacketTaskLine</code>{" "}
        from r{revisionNumber} into a new editable{" "}
        <code className="text-sky-100">QuoteLocalPacket</code> (originType ={" "}
        <code className="text-sky-100">FORK_FROM_LIBRARY</code>). The published revision is
        immutable and is never touched.
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-sky-200/60">
        Dev-only: paste a target DRAFT quote-version id below. A richer picker
        UX is out of scope for this slice. Source packet id:{" "}
        <code className="text-sky-100">{scopePacketId}</code>.
      </p>

      <div className="mt-3 grid gap-2">
        <label className="block text-[11px] text-sky-200/90">
          Target quote-version id
          <input
            type="text"
            value={quoteVersionId}
            onChange={(e) => setQuoteVersionId(e.target.value)}
            disabled={busy}
            placeholder="qv_…"
            className="mt-1 block w-full rounded border border-sky-800/60 bg-zinc-950/40 px-2 py-1 font-mono text-[11px] text-sky-100 placeholder:text-sky-300/30 focus:border-sky-600 focus:outline-none"
          />
        </label>
        <label className="block text-[11px] text-sky-200/90">
          displayName override (optional; defaults to{" "}
          <code className="text-sky-100">{defaultDisplayName}</code>)
          <input
            type="text"
            value={displayNameOverride}
            onChange={(e) => setDisplayNameOverride(e.target.value)}
            disabled={busy}
            placeholder={defaultDisplayName}
            className="mt-1 block w-full rounded border border-sky-800/60 bg-zinc-950/40 px-2 py-1 text-[11px] text-sky-100 placeholder:text-sky-300/30 focus:border-sky-600 focus:outline-none"
          />
        </label>
      </div>

      {error ? (
        <p className="mt-2 rounded border border-red-900/60 bg-red-950/30 px-2 py-1 text-[11px] text-red-300">
          {error}
        </p>
      ) : null}

      {success ? (
        <p className="mt-2 rounded border border-emerald-800/60 bg-emerald-950/30 px-2 py-1 text-[11px] text-emerald-200">
          Forked successfully — created QuoteLocalPacket{" "}
          <code className="text-emerald-100">{success.quoteLocalPacketId}</code>.{" "}
          <a
            href={`/dev/quote-scope/${encodeURIComponent(success.quoteVersionId)}`}
            className="underline hover:text-emerald-100"
          >
            Open quote-scope page →
          </a>
        </p>
      ) : null}

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={handleFork}
          disabled={busy || quoteVersionId.trim().length === 0}
          className="rounded border border-sky-700/60 bg-sky-900/40 px-3 py-1 text-[11px] font-semibold text-sky-100 hover:bg-sky-900/60 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Forking…" : "Fork to quote-local copy"}
        </button>
      </div>
    </section>
  );
}
