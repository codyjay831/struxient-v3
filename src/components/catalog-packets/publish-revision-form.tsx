"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Smallest safe interim publish affordance for a publish-ready DRAFT
 * `ScopePacketRevision`. Surfaced inline within the existing "Publish
 * readiness" panel on the dev catalog revision detail page; visible only
 * when the revision is DRAFT AND the readiness predicate returns
 * `isReady === true`.
 *
 * Calls POST /api/scope-packets/[id]/revisions/[revId]/publish, then
 * `router.refresh()` so the server-rendered page re-fetches the now-PUBLISHED
 * revision detail.
 *
 * Canon: docs/canon/05-packet-canon.md ("Canon amendment — interim publish authority"),
 * docs/implementation/decision-packs/interim-publish-authority-decision-pack.md.
 */
export function PublishRevisionForm({
  scopePacketId,
  scopePacketRevisionId,
  revisionNumber,
}: {
  scopePacketId: string;
  scopePacketRevisionId: string;
  revisionNumber: number;
}) {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePublish() {
    if (!confirmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/scope-packets/${encodeURIComponent(scopePacketId)}/revisions/${encodeURIComponent(
          scopePacketRevisionId,
        )}/publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      if (!res.ok) {
        let code = `HTTP_${res.status}`;
        let message = `Publish failed (HTTP ${res.status}).`;
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
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publish failed (network error).");
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 rounded border border-emerald-800/60 bg-emerald-950/30 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300/80">
        Publish revision r{revisionNumber}
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-emerald-200/80">
        Interim publish authority: any office user on this tenant may publish a
        publish-ready DRAFT revision. Publishing atomically sets{" "}
        <code className="text-emerald-100">status = PUBLISHED</code> and{" "}
        <code className="text-emerald-100">publishedAt = now</code>. Once
        published the revision becomes selectable for quote-line scope pins
        (under the existing <code className="text-emerald-100">LINE_SCOPE_REVISION_NOT_PUBLISHED</code>{" "}
        guard) and is canon-immutable thereafter.
      </p>
      <label className="mt-2 flex items-start gap-2 text-[11px] text-emerald-200/90">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          disabled={busy}
          className="mt-0.5"
        />
        <span>
          I understand this is irreversible in the interim slice — there is no
          un-publish action and the published revision cannot be edited.
        </span>
      </label>
      {error ? (
        <p className="mt-2 rounded border border-red-900/60 bg-red-950/30 px-2 py-1 text-[11px] text-red-300">
          {error}
        </p>
      ) : null}
      <div className="mt-2 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={handlePublish}
          disabled={!confirmed || busy}
          className="rounded border border-emerald-700/60 bg-emerald-900/40 px-3 py-1 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-900/60 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Publishing…" : "Publish revision"}
        </button>
      </div>
    </div>
  );
}
