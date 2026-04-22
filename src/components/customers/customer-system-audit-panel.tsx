"use client";

import { useCallback, useEffect, useState } from "react";
import type { CustomerAuditEventListItemDto } from "@/server/slice1/reads/customer-audit-reads";

type Props = {
  customerId: string;
  initialEvents: CustomerAuditEventListItemDto[];
};

/**
 * Read-only **system audit** tail for the customer (Epic 57). Not a merged CRM timeline — see “Recent activity” above.
 */
export function CustomerSystemAuditPanel({ customerId, initialEvents }: Props) {
  const [events, setEvents] = useState(initialEvents);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setEvents(initialEvents);
  }, [initialEvents]);

  const refresh = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/customers/${encodeURIComponent(customerId)}/audit-events`, {
        credentials: "include",
      });
      const j = (await res.json().catch(() => ({}))) as {
        data?: { events?: CustomerAuditEventListItemDto[] };
        error?: { message?: string };
      };
      if (!res.ok) {
        setErr(j.error?.message ?? `Load failed (${res.status})`);
        return;
      }
      setEvents(j.data?.events ?? []);
    } finally {
      setBusy(false);
    }
  }, [customerId]);

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">System audit (recent)</h2>
        <button
          type="button"
          disabled={busy}
          onClick={() => void refresh()}
          className="text-[11px] text-zinc-500 hover:text-zinc-300 disabled:opacity-50"
        >
          {busy ? "Loading…" : "Refresh"}
        </button>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
        Immutable log of office actions on this customer (contacts, notes lifecycle, files). Does not include quote or job
        workflow events unless they are recorded with this customer anchor later.
      </p>
      {err ? <p className="mt-2 text-xs text-rose-400/90">{err}</p> : null}
      {events.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">No audit entries yet for this customer.</p>
      ) : (
        <ul className="mt-4 space-y-2 border-t border-zinc-800/60 pt-3">
          {events.map((e) => (
            <li key={e.id} className="rounded border border-zinc-800/50 bg-zinc-950/40 px-3 py-2 text-xs">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                <span className="font-medium text-zinc-200">{e.title}</span>
                <time className="shrink-0 font-mono text-[10px] text-zinc-500" dateTime={e.occurredAtIso}>
                  {e.occurredAtIso.replace("T", " ").slice(0, 19)} UTC
                </time>
              </div>
              <p className="mt-0.5 text-[11px] text-zinc-400">{e.summary}</p>
              {e.actorLabel ? (
                <p className="mt-1 text-[10px] text-zinc-600">By {e.actorLabel}</p>
              ) : (
                <p className="mt-1 text-[10px] text-zinc-600">Actor unknown</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
