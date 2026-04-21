"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { InternalActionResult } from "@/components/internal/internal-action-result";

export type SentSignTarget = {
  quoteVersionId: string;
  versionNumber: number;
};

type Props = {
  signTarget: SentSignTarget | null;
  canOfficeMutate: boolean;
};

/**
 * Office sign for the **newest SENT** row in workspace history (see `deriveNewestSentSignTarget`).
 * `POST /api/quote-versions/:id/sign` — body unused; actor from session.
 */
export function QuoteWorkspaceSignSent({ signTarget, canOfficeMutate }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ kind: "success" | "error"; title: string; message?: string; technicalDetails?: string } | null>(null);

  async function runSign() {
    if (!signTarget || !canOfficeMutate) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(`/api/quote-versions/${encodeURIComponent(signTarget.quoteVersionId)}/sign`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = (await res.json().catch(() => ({}))) as {
        data?: { status?: string; signedAt?: string };
        error?: { code?: string; message?: string; activation?: unknown };
      };
      if (!res.ok) {
        const extra =
          body.error?.code === "SIGN_ROLLED_BACK_AUTO_ACTIVATE_FAILED" ?
            " (auto-activate after sign failed; transaction rolled back — see activation error in response.)"
          : "";
        setResult({
          kind: "error",
          title: "Signature failed",
          message: body.error?.message ?? "An error occurred while recording the customer signature.",
          technicalDetails: `${body.error?.code ?? "ERROR"}: ${res.status}${extra}`,
        });
        return;
      }
      setResult({
        kind: "success",
        title: "Quote signed",
        message: "The customer signature has been recorded. This version is now ready to activate execution.",
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!signTarget) {
    return (
      <section className="mb-6 rounded border border-zinc-800 bg-zinc-950/30 p-4 text-sm">
        <h2 className="mb-1 text-sm font-medium text-zinc-200">Record signature</h2>
        <p className="text-xs text-zinc-500">
          Quote signed. Next step: <span className="font-medium text-teal-400">Activate execution</span>.
        </p>
      </section>
    );
  }

  return (
    <section className="mb-6 rounded border border-zinc-800 bg-zinc-950/30 p-4 text-sm border-violet-900/20 bg-violet-950/5">
      <h2 className="mb-1 text-sm font-medium text-zinc-200">Record signature</h2>
      <p className="text-xs text-zinc-500">Formal customer approval for v{signTarget.versionNumber}.</p>

      {!canOfficeMutate ? (
        <p className="mt-3 text-xs text-zinc-500">
          Recording signatures requires an office session with elevated permissions.
        </p>
      ) : (
        <div className="mt-4">
          <button
            type="button"
            disabled={busy}
            onClick={() => void runSign()}
            className="rounded bg-violet-900/85 px-4 py-1.5 text-xs font-medium text-violet-50 hover:bg-violet-800/90 disabled:opacity-50 transition-colors"
          >
            {busy ? "Signing…" : "Record customer signature"}
          </button>
          <p className="mt-2 text-[11px] text-zinc-500">
            Confirming the signature will move v{signTarget.versionNumber} to{" "}
            <span className="text-zinc-400 font-medium">SIGNED</span> and allow for execution
            activation.
          </p>
        </div>
      )}

      <div className="mt-4 border-t border-zinc-800/40 pt-3">
        <details className="text-[10px] text-zinc-600">
          <summary className="cursor-pointer font-medium hover:text-zinc-500">
            Technical details
          </summary>
          <div className="mt-2 space-y-2">
            <p>
              Target: v{signTarget.versionNumber} ·{" "}
              <span className="font-mono">{signTarget.quoteVersionId}</span>
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono">
              <code className="text-zinc-500">POST …/sign</code>
              <Link
                href={`/api/quote-versions/${signTarget.quoteVersionId}/lifecycle`}
                className="underline hover:text-zinc-500"
              >
                Lifecycle JSON
              </Link>
              <Link
                href={`/api/quote-versions/${signTarget.quoteVersionId}/freeze`}
                className="underline hover:text-zinc-500"
              >
                Freeze JSON
              </Link>
            </div>
            <p className="text-zinc-500 italic">
              Server records session actor and timestamp. Supports idempotency.
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
              ? { label: "Activate execution", href: "#step-5" } 
              : undefined
          }
        />
      )}
    </section>
  );
}
