"use client";

import type { SignedActivatableTarget } from "@/lib/workspace/derive-workspace-signed-activate-target";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  activateTarget: SignedActivatableTarget | null;
  canOfficeMutate: boolean;
};

/**
 * Office activate for the **newest SIGNED** row without an activation row (see `deriveNewestSignedWithoutActivationTarget`).
 * `POST /api/quote-versions/:id/activate` — body unused; actor from session.
 */
export function QuoteWorkspaceActivateSigned({ activateTarget, canOfficeMutate }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function runActivate() {
    if (!activateTarget || !canOfficeMutate) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/quote-versions/${encodeURIComponent(activateTarget.quoteVersionId)}/activate`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = (await res.json().catch(() => ({}))) as {
        data?: { activationId?: string; flowId?: string };
        error?: { code?: string; message?: string };
      };
      if (!res.ok) {
        setMessage(`${body.error?.code ?? "ERROR"}: ${body.error?.message ?? res.status}`);
        return;
      }
      setMessage("Activated — refreshing…");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!activateTarget) {
    return (
      <section className="mb-6 rounded border border-zinc-800 bg-zinc-950/25 p-4 text-sm">
        <h2 className="mb-1 text-sm font-medium text-zinc-200">Activate execution</h2>
        <p className="text-xs text-zinc-500">
          Execution activation is available for versions that have been signed but not yet launched. 
          Complete the signature step or select a signed revision in history to proceed.
        </p>
      </section>
    );
  }

  return (
    <section className="mb-6 rounded border border-zinc-800 bg-zinc-950/25 p-4 text-sm">
      <h2 className="mb-1 text-sm font-medium text-zinc-200">Activate execution</h2>
      <p className="text-xs text-zinc-500">
        Start the runtime flow for v{activateTarget.versionNumber}.
      </p>

      {!canOfficeMutate ?
        <p className="mt-3 text-xs text-zinc-500">
          Activating execution requires an office session with elevated permissions.
        </p>
      : <div className="mt-4">
          <button
            type="button"
            disabled={busy}
            onClick={() => void runActivate()}
            className="rounded bg-teal-900/85 px-4 py-1.5 text-xs font-medium text-teal-50 hover:bg-teal-800/90 disabled:opacity-50 transition-colors"
          >
            {busy ? "Activating…" : "Launch execution"}
          </button>
          <p className="mt-2 text-[11px] text-zinc-500 leading-relaxed">
            Launching will populate the stable node-based runtime structure for this quote. 
            Once activated, the quote will move into the execution phase.
          </p>
        </div>
      }

      <div className="mt-4 border-t border-zinc-800/40 pt-3">
        <details className="text-[10px] text-zinc-600">
          <summary className="cursor-pointer font-medium hover:text-zinc-500">Technical details</summary>
          <div className="mt-2 space-y-2">
            <p>Target: v{activateTarget.versionNumber} · <span className="font-mono">{activateTarget.quoteVersionId}</span></p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono">
              <code className="text-zinc-500">POST …/activate</code>
              <Link
                href={`/api/quote-versions/${activateTarget.quoteVersionId}/lifecycle`}
                className="underline hover:text-zinc-500"
              >
                Lifecycle JSON
              </Link>
              <Link
                href={`/api/quote-versions/${activateTarget.quoteVersionId}/freeze`}
                className="underline hover:text-zinc-500"
              >
                Freeze JSON
              </Link>
            </div>
            <p className="text-zinc-500 italic">Uses frozen snapshots from the send step. Requires prior signature and job shell.</p>
          </div>
        </details>
      </div>
      {message ? <p className="mt-2 text-xs text-zinc-400">{message}</p> : null}
    </section>
  );
}
