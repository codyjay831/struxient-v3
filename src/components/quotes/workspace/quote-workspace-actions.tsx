"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { InternalActionResult } from "@/components/internal/internal-action-result";

type Props = {
  quoteId: string;
  canOfficeMutate: boolean;
};

/**
 * Minimal workspace actions: reuses `POST /api/quotes/:quoteId/versions` (office_mutate). No duplicate mutation APIs.
 */
export function QuoteWorkspaceActions({ quoteId, canOfficeMutate }: Props) {
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

  return (
    <section
      id="revision-management"
      className="mb-6 rounded border border-zinc-700/80 bg-zinc-900/50 p-4 text-sm"
    >
      <h2 className="mb-2 text-sm font-medium text-zinc-200">Revision management</h2>
      {!canOfficeMutate ? (
        <p className="text-xs text-zinc-500">
          Creating a new version requires an office session with elevated permissions.
          Sign in at <code className="text-zinc-400">/login</code> as office to perform this action.
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-zinc-500 leading-relaxed">
            Start a new draft version to revise the quote. This clones the current version so you can modify line items
            or field work before sending a new proposal.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void createNextVersion()}
            className="rounded bg-amber-800/90 px-3 py-1.5 text-xs font-medium text-amber-50 hover:bg-amber-700 disabled:opacity-50 transition-colors"
          >
            {busy ? "Creating…" : "Create new draft version"}
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
            result.kind === "success" 
              ? { label: "Review scope", href: "#line-items" } 
              : undefined
          }
        />
      )}
      
      <div className="mt-4 border-t border-zinc-800/40 pt-3">
        <details className="text-[10px] text-zinc-600">
          <summary className="cursor-pointer font-medium hover:text-zinc-500">Advanced (support)</summary>
          <p className="mt-1">
            Calls <code className="text-zinc-500">POST /api/quotes/{quoteId}/versions</code>. Clones server-side state.
          </p>
        </details>
      </div>
    </section>
  );
}
