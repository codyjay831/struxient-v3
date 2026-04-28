"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { InternalActionResult } from "@/components/internal/internal-action-result";

type Props = {
  quoteId: string;
  canOfficeMutate: boolean;
  /**
   * `demoted`: quieter chrome for revision-from-head when the main surface is already
   * the embedded line editor (e.g. rail / versions area).
   */
  variant?: "default" | "demoted";
};

/**
 * Minimal workspace actions: reuses `POST /api/quotes/:quoteId/versions` (office_mutate). No duplicate mutation APIs.
 */
export function QuoteWorkspaceActions({
  quoteId,
  canOfficeMutate,
  variant = "default",
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ kind: "success" | "error"; title: string; message?: string; technicalDetails?: string } | null>(null);

  async function createNextVersion() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(`/api/quotes/${encodeURIComponent(quoteId)}/versions`, {
        method: "POST",
        credentials: "include",
      });
      const body = (await res.json().catch(() => ({}))) as {
        data?: { versionNumber?: number; quoteVersionId?: string };
        error?: { code?: string; message?: string };
      };
      if (!res.ok) {
        setResult({
          kind: "error",
          title: "Version creation failed",
          message: body.error?.message ?? "An unexpected error occurred while creating a new draft.",
          technicalDetails: `${body.error?.code ?? "ERROR"}: ${res.status}`,
        });
        return;
      }
      setResult({
        kind: "success",
        title: "New version created",
        message: `Version v${String(body.data?.versionNumber)} is now the head draft. Update scope or field work on this draft, then send again when you are ready.`,
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const isDemoted = variant === "demoted";

  return (
    <section
      id="start-new-draft"
      className={
        isDemoted ?
          "mb-3 rounded-md border border-zinc-800/60 bg-zinc-950/25 p-3 text-xs text-zinc-500"
        : "mb-6 rounded-md border border-zinc-800/80 bg-zinc-950/35 p-4 text-sm"
      }
    >
      <h2
        className={
          isDemoted ? "mb-1.5 text-xs font-medium text-zinc-400" : "mb-2 text-base font-semibold text-zinc-100"
        }
      >
        {isDemoted ? "Revise quote" : "Start a new draft"}
      </h2>
      {!canOfficeMutate ? (
        <p className={isDemoted ? "text-xs text-zinc-600" : "text-sm text-zinc-500"}>
          Creating a new version requires an office session with elevated permissions.
          Sign in at <code className="text-zinc-400">/login</code> as office to perform this action.
        </p>
      ) : (
        <div className={isDemoted ? "space-y-2" : "space-y-3"}>
          <p className={isDemoted ? "text-xs leading-snug text-zinc-600" : "text-sm text-zinc-500"}>
            {isDemoted ?
              "Clones the head draft as a new version you can edit and send separately."
            : "Clones this revision so you can change lines and tasks, then send a new proposal when ready."}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void createNextVersion()}
            className={
              isDemoted ?
                "rounded-md border border-zinc-600/90 bg-zinc-900/50 px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800 disabled:opacity-50 transition-colors"
              : "rounded-md bg-amber-800/90 px-4 py-2 text-sm font-medium text-amber-50 hover:bg-amber-700 disabled:opacity-50 transition-colors"
            }
          >
            {busy ? "Creating…" : isDemoted ? "Create revision draft" : "Create new draft version"}
          </button>
        </div>
      )}
      {result && (
        <InternalActionResult
          kind={result.kind}
          title={result.title}
          message={result.message}
          technicalDetails={result.technicalDetails}
          nextStep={
            result.kind === "success" ?
              { label: "Line & tasks", href: `/quotes/${encodeURIComponent(quoteId)}/scope` }
            : undefined
          }
        />
      )}

      {!isDemoted ?
        <div className="mt-4 border-t border-zinc-800/40 pt-3">
          <details className="text-xs text-zinc-600">
            <summary className="cursor-pointer font-medium text-zinc-500 hover:text-zinc-400">Support & IDs</summary>
            <p className="mt-1 text-zinc-500">
              Creates the next draft from the current version (same server route as before).
            </p>
          </details>
        </div>
      : null}
    </section>
  );
}
