"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { InternalActionResult } from "@/components/internal/internal-action-result";

export type HeadDraftPinTarget = {
  quoteVersionId: string;
  versionNumber: number;
  pinnedWorkflowVersionId: string | null;
};

type Props = {
  /** Only set when workspace head exists and is DRAFT; pin PATCH is draft-only. */
  pinTarget: HeadDraftPinTarget | null;
  canOfficeMutate: boolean;
};

type PublishedCatalogItem = {
  id: string;
  templateDisplayName: string;
  templateKey: string;
  versionNumber: number;
  status: string;
};

/**
 * Pin via `PATCH /api/quote-versions/:id`. Published versions from `GET /api/workflow-versions` (`read`) + manual id.
 */
export function QuoteWorkspacePinWorkflow({ pinTarget, canOfficeMutate }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ kind: "success" | "error"; title: string; message?: string; technicalDetails?: string } | null>(null);
  const [draftId, setDraftId] = useState("");
  const [catalog, setCatalog] = useState<PublishedCatalogItem[] | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  useEffect(() => {
    setDraftId(pinTarget?.pinnedWorkflowVersionId ?? "");
  }, [pinTarget?.quoteVersionId, pinTarget?.pinnedWorkflowVersionId]);

  const loadCatalog = useCallback(async () => {
    setCatalogError(null);
    try {
      const res = await fetch("/api/workflow-versions?limit=100", { credentials: "include" });
      const body = (await res.json().catch(() => ({}))) as {
        data?: { items?: PublishedCatalogItem[] };
        error?: { code?: string; message?: string };
      };
      if (!res.ok) {
        setCatalog([]);
        setCatalogError(`${body.error?.code ?? "ERROR"}: ${body.error?.message ?? res.status}`);
        return;
      }
      setCatalog(body.data?.items ?? []);
    } catch {
      setCatalog([]);
      setCatalogError("Failed to load published workflow versions.");
    }
  }, []);

  useEffect(() => {
    if (!pinTarget) {
      setCatalog(null);
      return;
    }
    void loadCatalog();
    // `pinTarget` from the server page is a fresh object each render; depend on stable id only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadCatalog, pinTarget?.quoteVersionId]);

  async function patchPin(pinnedWorkflowVersionId: string | null) {
    if (!pinTarget || !canOfficeMutate) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(`/api/quote-versions/${encodeURIComponent(pinTarget.quoteVersionId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinnedWorkflowVersionId }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        data?: { pinnedWorkflowVersionId?: string | null };
        error?: { code?: string; message?: string };
      };
      if (!res.ok) {
        setResult({
          kind: "error",
          title: "Save failed",
          message: body.error?.message ?? "An unexpected error occurred while pinning the workflow.",
          technicalDetails: `${body.error?.code ?? "ERROR"}: ${res.status}`,
        });
        return;
      }
      const next = body.data?.pinnedWorkflowVersionId ?? null;
      setDraftId(next ?? "");
      setResult({
        kind: "success",
        title: pinnedWorkflowVersionId ? "Process template pinned" : "Process template unpinned",
        message: pinnedWorkflowVersionId
          ? "The process template provides the node/stage skeleton. Your line items / packets will compose onto this template's nodes when you send."
          : "This draft no longer has a process template pinned. Pin one before sending so packets can compose onto its nodes.",
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function applyPinnedId() {
    const trimmed = draftId.trim();
    if (trimmed === "") {
      setResult({
        kind: "error",
        title: "No template chosen",
        message: "Pick a published process template from the list, paste an id, or use Unpin template.",
      });
      return;
    }
    await patchPin(trimmed);
  }

  async function clearPin() {
    await patchPin(null);
  }

  if (!pinTarget) {
    return (
      <section className="mb-6 rounded border border-zinc-800 bg-zinc-950/40 p-4 text-sm">
        <h2 className="mb-1 text-sm font-medium text-zinc-200">Process template</h2>
        <p className="text-xs text-zinc-500">
          The pinned process template can only be changed on a draft version. The current version is locked.
        </p>
      </section>
    );
  }

  return (
    <section className="mb-6 rounded border border-zinc-800 bg-zinc-950/40 p-4 text-sm">
      <h2 className="mb-1 text-sm font-medium text-zinc-200">Pin process template</h2>
      <p className="text-xs text-zinc-500">
        The process template defines the <span className="text-zinc-300">node/stage skeleton</span> this engagement
        will run through. It does <span className="text-zinc-300">not</span> define the work — your line items and
        packets do that. At send time, your packets are composed onto this template&apos;s nodes.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-zinc-500">Current template:</span>
        {pinTarget.pinnedWorkflowVersionId ?
          <span className="font-medium text-zinc-200">
            {catalog?.find(i => i.id === pinTarget.pinnedWorkflowVersionId)?.templateDisplayName ?? "Pinned"} (v{catalog?.find(i => i.id === pinTarget.pinnedWorkflowVersionId)?.versionNumber ?? "…"})
          </span>
        : <span className="text-amber-700/90 font-medium italic">No template pinned</span>}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-zinc-500">Available templates:</span>
        {canOfficeMutate ?
          <select
            id="wf-pin-select"
            disabled={busy || catalog === null}
            value={catalog?.some((i) => i.id === draftId) ? draftId : ""}
            onChange={(e) => setDraftId(e.target.value)}
            className="max-w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200 disabled:opacity-50"
          >
            <option value="">Choose a process template…</option>
            {catalog?.map((i) => (
              <option key={i.id} value={i.id}>
                {i.templateDisplayName} (v{i.versionNumber})
              </option>
            ))}
          </select>
        : catalog && catalog.length > 0 ?
          <ul className="max-h-28 max-w-full flex-1 list-inside list-disc overflow-y-auto text-zinc-400">
            {catalog.map((i) => (
              <li key={i.id}>
                {i.templateDisplayName} (v{i.versionNumber})
              </li>
            ))}
          </ul>
        : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => void loadCatalog()}
          className="text-zinc-500 underline decoration-zinc-600 hover:text-zinc-400 disabled:opacity-50"
        >
          Refresh list
        </button>
      </div>

      {catalogError ? <p className="mt-1 text-xs text-amber-600/90">{catalogError}</p> : null}

      {!canOfficeMutate ?
        <p className="mt-2 text-xs text-zinc-500">
          Changing the pinned process template requires an office session with elevated permissions.
        </p>
      : <>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !draftId}
              onClick={() => void applyPinnedId()}
              className="rounded bg-sky-900/80 px-4 py-1.5 text-xs font-medium text-sky-50 hover:bg-sky-800/90 disabled:opacity-50 transition-colors"
            >
              {busy ? "Pinning…" : "Pin template"}
            </button>
            <button
              type="button"
              disabled={busy || pinTarget.pinnedWorkflowVersionId == null}
              onClick={() => void clearPin()}
              className="rounded border border-zinc-600 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800/80 disabled:opacity-40 transition-colors"
            >
              Unpin template
            </button>
          </div>

          <div className="mt-4 border-t border-zinc-800/40 pt-3">
            <details className="text-[10px] text-zinc-600">
              <summary className="cursor-pointer font-medium hover:text-zinc-500">Technical details</summary>
              <div className="mt-2 space-y-2">
                <p>Target: v{pinTarget.versionNumber} · <span className="font-mono">{pinTarget.quoteVersionId}</span></p>
                <p className="text-zinc-600">
                  Stored as <code className="font-mono">QuoteVersion.pinnedWorkflowVersionId</code>. The DB column name
                  is historical; UX uses &quot;process template&quot; to match canon (`docs/canon/06-node-and-flowspec-canon.md`).
                </p>
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] uppercase tracking-wider text-zinc-500">Manual ID Entry</span>
                  <input
                    type="text"
                    value={draftId}
                    onChange={(e) => setDraftId(e.target.value)}
                    placeholder="workflowVersion ID"
                    disabled={busy}
                    className="w-full min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 font-mono text-[11px] text-zinc-200 placeholder:text-zinc-600 disabled:opacity-50"
                  />
                </div>
                <div className="flex gap-3 pt-1">
                  <Link href="/api/workflow-versions?limit=100" prefetch={false} className="underline hover:text-zinc-500">
                    Catalog JSON
                  </Link>
                  <code className="text-zinc-500">PATCH /api/quote-versions/&lt;id&gt;</code>
                </div>
              </div>
            </details>
          </div>
        </>
      }
      {result && (
        <InternalActionResult
          kind={result.kind}
          title={result.title}
          message={result.message}
          technicalDetails={result.technicalDetails}
          nextStep={
            result.kind === "success" && pinTarget.pinnedWorkflowVersionId
              ? { label: "Prepare & send proposal", href: "#step-3" }
              : undefined
          }
        />
      )}
    </section>
  );
}
