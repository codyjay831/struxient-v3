"use client";

import type { SignedActivatableTarget } from "@/lib/workspace/derive-workspace-signed-activate-target";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { InternalActionResult } from "@/components/internal/internal-action-result";

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
  const [result, setResult] = useState<{ kind: "success" | "error"; title: string; message?: string; technicalDetails?: string } | null>(null);

  async function runActivate() {
    if (!activateTarget || !canOfficeMutate) return;
    setBusy(true);
    setResult(null);
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
        setResult({
          kind: "error",
          title: "Could not start work",
          message: body.error?.message ?? "An error occurred while starting work for this quote.",
          technicalDetails: `${body.error?.code ?? "ERROR"}: ${res.status}`,
        });
        return;
      }
      setResult({
        kind: "success",
        title: "Work started",
        message: "You can track progress in the work feed or flow detail.",
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!activateTarget) {
    return (
      <section className="mb-6 rounded border border-zinc-800 bg-zinc-950/25 p-4 text-sm">
        <h2 className="mb-1 text-sm font-medium text-zinc-200">Start work</h2>
        <p className="text-xs text-zinc-500">
          Work has been started. Use <span className="font-medium text-sky-400">Job execution</span> below to open the
          work feed.
        </p>
      </section>
    );
  }

  return (
    <section className="mb-6 rounded border border-zinc-800 bg-zinc-950/25 p-4 text-sm">
      <h2 className="mb-1 text-sm font-medium text-zinc-200">Start work</h2>
      <p className="text-xs text-zinc-500">
        Create the job task list from the signed proposal for v{activateTarget.versionNumber}.
      </p>

      {!canOfficeMutate ? (
        <p className="mt-3 text-xs text-zinc-500">
          Starting work requires an office session with elevated permissions.
        </p>
      ) : (
        <div className="mt-4">
          <button
            type="button"
            disabled={busy}
            onClick={() => void runActivate()}
            className="rounded bg-teal-900/85 px-4 py-1.5 text-xs font-medium text-teal-50 hover:bg-teal-800/90 disabled:opacity-50 transition-colors"
          >
            {busy ? "Starting…" : "Start work"}
          </button>
          <p className="mt-2 text-[11px] text-zinc-500 leading-relaxed">
            This creates the job task list from the locked proposal. After this, you can track work from Job execution.
          </p>
        </div>
      )}

      <div className="mt-4 border-t border-zinc-800/40 pt-3">
        <details className="text-[10px] text-zinc-600">
          <summary className="cursor-pointer font-medium hover:text-zinc-500">
            Advanced (support)
          </summary>
          <div className="mt-2 space-y-2">
            <p>
              Target: v{activateTarget.versionNumber} ·{" "}
              <span className="font-mono">{activateTarget.quoteVersionId}</span>
            </p>
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
            <p className="text-zinc-500 italic">
              Uses the locked proposal from the send step. Requires prior signature and job shell.
            </p>
          </div>
        </details>
      </div>
      {result && (
        <InternalActionResult
          kind={result.kind}
          title={result.title}
          message={result.message}
          technicalDetails={result.technicalDetails}
          nextStep={
            result.kind === "success" 
              ? { label: "Open job", href: "#execution-bridge" } 
              : undefined
          }
        />
      )}
    </section>
  );
}
