"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { InternalActionResult } from "@/components/internal/internal-action-result";

/** Mirrors `ComposePreviewResponseDto` fields we surface (avoid importing server-only types). */
type ComposePreviewData = {
  quoteVersionId: string;
  stalenessToken: string | null;
  staleness: "fresh" | "stale";
  errors: { code: string; message: string }[];
  warnings: { code: string; message: string }[];
  stats: {
    lineItemCount: number;
    planTaskCount: number;
    packageTaskCount: number;
    skeletonSlotCount: number;
    soldSlotCount: number;
  };
};

export type LatestDraftWorkspaceTarget = {
  quoteVersionId: string;
  versionNumber: number;
  hasPinnedWorkflow: boolean;
};

type Props = {
  latestDraft: LatestDraftWorkspaceTarget | null;
  canOfficeMutate: boolean;
};

function newSendClientRequestId(): string {
  return `ws-send-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Minimal compose-preview + send surface for the **latest** quote version when it is DRAFT.
 * Uses existing `POST /api/quote-versions/:id/compose-preview` and `…/send` only (no workspace duplicates).
 */
export function QuoteWorkspaceComposeSendPanel({ latestDraft, canOfficeMutate }: Props) {
  const router = useRouter();
  const [composeBusy, setComposeBusy] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);
  const [result, setResult] = useState<{ kind: "success" | "error"; title: string; message?: string; technicalDetails?: string } | null>(null);
  /** Token from the last successful compose HTTP response (`data.stalenessToken`); required body field for send. */
  const [stalenessTokenForSend, setStalenessTokenForSend] = useState<string | null | undefined>(undefined);
  const [lastCompose, setLastCompose] = useState<ComposePreviewData | null>(null);

  const resetSendLocalState = useCallback(() => {
    setStalenessTokenForSend(undefined);
    setLastCompose(null);
    setResult(null);
  }, []);

  const runComposePreview = useCallback(async () => {
    if (!latestDraft || !canOfficeMutate) return;
    setComposeBusy(true);
    setResult(null);
    try {
      const res = await fetch(
        `/api/quote-versions/${encodeURIComponent(latestDraft.quoteVersionId)}/compose-preview`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientStalenessToken: lastCompose ? lastCompose.stalenessToken : null,
            acknowledgedWarningCodes: [],
          }),
        },
      );
      const body = (await res.json().catch(() => ({}))) as {
        data?: ComposePreviewData;
        error?: { code?: string; message?: string };
      };
      if (!res.ok) {
        setLastCompose(null);
        setStalenessTokenForSend(undefined);
        setResult({
          kind: "error",
          title: "Preview generation failed",
          message: body.error?.message ?? "An error occurred while generating the proposal preview.",
          technicalDetails: `${body.error?.code ?? "ERROR"}: ${res.status}`,
        });
        return;
      }
      if (!body.data) {
        setResult({
          kind: "error",
          title: "Preview failed",
          message: "The server returned a successful response but no preview data was found.",
        });
        return;
      }
      setLastCompose(body.data);
      setStalenessTokenForSend(body.data.stalenessToken);
      
      const hasErrors = body.data.errors.length > 0;
      setResult({
        kind: hasErrors ? "error" : "success",
        title: hasErrors ? "Preview found blocking errors" : "Preview generated",
        message: hasErrors 
          ? `There are ${body.data.errors.length} errors that must be fixed before this proposal can be sent.` 
          : "The proposal composition is valid. You can now send it to the customer.",
      });
    } finally {
      setComposeBusy(false);
    }
  }, [canOfficeMutate, latestDraft, lastCompose]);

  const runSend = useCallback(async () => {
    if (!latestDraft || !canOfficeMutate) return;
    if (stalenessTokenForSend === undefined) {
      setResult({
        kind: "error",
        title: "Action blocked",
        message: "Run compose preview first; send requires a fresh staleness token from the server.",
      });
      return;
    }
    setSendBusy(true);
    setResult(null);
    try {
      const res = await fetch(`/api/quote-versions/${encodeURIComponent(latestDraft.quoteVersionId)}/send`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientStalenessToken: stalenessTokenForSend,
          sendClientRequestId: newSendClientRequestId(),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        data?: { status?: string };
        error?: { code?: string; message?: string; composeErrors?: { code: string; message: string }[] };
      };
      if (!res.ok) {
        const extra =
          body.error?.composeErrors?.length ?
            ` — ${body.error.composeErrors.map((e) => e.code).join(", ")}`
          : "";
        setResult({
          kind: "error",
          title: "Send failed",
          message: body.error?.message ?? "An error occurred while sending the proposal.",
          technicalDetails: `${body.error?.code ?? "ERROR"}: ${res.status}${extra}`,
        });
        return;
      }
      setResult({
        kind: "success",
        title: "Proposal sent",
        message: "The proposal has been frozen and sent to the customer. This version is now waiting for a formal signature.",
      });
      setStalenessTokenForSend(undefined);
      setLastCompose(null);
      router.refresh();
    } finally {
      setSendBusy(false);
    }
  }, [canOfficeMutate, latestDraft, router, stalenessTokenForSend]);

  const composeBlocking = lastCompose != null && lastCompose.errors.length > 0;
  const sendReady =
    latestDraft != null &&
    latestDraft.hasPinnedWorkflow &&
    lastCompose != null &&
    !composeBlocking &&
    stalenessTokenForSend !== undefined;

  const summaryLines = useMemo(() => {
    if (!lastCompose) return null;
    const { stats, staleness, errors, warnings, stalenessToken } = lastCompose;
    return (
      <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs text-zinc-400">
        <li>
          Staleness: <span className="text-zinc-300">{staleness}</span> · token for send:{" "}
          <code className="text-zinc-400">{stalenessToken === null ? "null" : (stalenessToken ?? "—")}</code>
        </li>
        <li>
          Stats: lines {stats.lineItemCount}, plan tasks {stats.planTaskCount}, package tasks{" "}
          {stats.packageTaskCount}
        </li>
        {errors.length > 0 ?
          <li className="text-amber-600/90">
            {errors.length} blocking error(s): {errors.map((e) => e.code).join(", ")}
          </li>
        : null}
        {warnings.length > 0 ?
          <li className="text-zinc-500">
            {warnings.length} warning(s): {warnings.map((w) => w.code).join(", ")}
          </li>
        : null}
      </ul>
    );
  }, [lastCompose]);

  if (!latestDraft) {
    return (
      <section className="mb-6 rounded border border-zinc-800 bg-zinc-950/60 p-4 text-sm">
        <h2 className="mb-1 text-sm font-medium text-zinc-200">Prepare & send proposal</h2>
        <p className="text-xs text-zinc-500">
          Proposal sent. Next step: <span className="font-medium text-violet-400">Record signature</span>.
        </p>
      </section>
    );
  }

  return (
    <section className="mb-6 rounded border border-zinc-800 bg-zinc-950/60 p-4 text-sm border-rose-900/20 bg-rose-950/5">
      <h2 className="mb-1 text-sm font-medium text-zinc-200">Prepare & send proposal</h2>
      <p className="text-xs text-zinc-500">
        Review the proposal composition for v{latestDraft.versionNumber} and send it to the
        customer.
      </p>

      {!canOfficeMutate ? (
        <p className="mt-2 text-xs text-zinc-500">
          Preparing and sending proposals requires an office session with elevated permissions.
        </p>
      ) : (
        <>
          {!latestDraft.hasPinnedWorkflow ? (
            <p className="mt-2 text-xs text-amber-700/90">
              <span className="font-medium text-amber-600/90">
                A workflow must be selected before sending.
              </span>{" "}
              You can still run a preview to check line items, but send will remain disabled.
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={composeBusy}
              onClick={() => void runComposePreview()}
              className="rounded bg-zinc-700 px-4 py-1.5 text-xs font-medium text-zinc-100 hover:bg-zinc-600 disabled:opacity-50 transition-colors"
            >
              {composeBusy ? "Generating preview…" : "Preview proposal"}
            </button>
            <button
              type="button"
              disabled={sendBusy || !sendReady}
              title={
                !sendReady ?
                  !latestDraft.hasPinnedWorkflow ?
                    "Select a workflow first."
                  : !lastCompose ?
                    "Run preview to verify content."
                  : composeBlocking ?
                    "Fix blocking errors before sending."
                  : "Run preview to obtain latest token."
                : undefined
              }
              onClick={() => void runSend()}
              className="rounded bg-rose-900/80 px-4 py-1.5 text-xs font-medium text-rose-50 hover:bg-rose-800/90 disabled:opacity-40 transition-colors"
            >
              {sendBusy ? "Sending…" : "Send proposal"}
            </button>
          </div>

          <p className="mt-3 text-[11px] text-zinc-500 leading-relaxed">
            Sending the proposal will <span className="text-zinc-400 font-medium">freeze</span> this
            version. No further changes can be made to v{latestDraft.versionNumber} after it is
            sent.
          </p>

          {result && (
            <InternalActionResult
              kind={result.kind}
              title={result.title}
              message={result.message}
              technicalDetails={result.technicalDetails}
              nextStep={
                result.kind === "success" && result.title === "Proposal sent"
                  ? { label: "Record signature", href: "#step-4" }
                  : undefined
              }
            />
          )}
          {summaryLines}

          <div className="mt-4 border-t border-zinc-800/40 pt-3">
            <details className="text-[10px] text-zinc-600">
              <summary className="cursor-pointer font-medium hover:text-zinc-500">
                Technical details
              </summary>
              <div className="mt-2 space-y-2">
                <p>
                  Version ID: <span className="font-mono">{latestDraft.quoteVersionId}</span>
                </p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono">
                  <code className="text-zinc-500">POST …/compose-preview</code>
                  <code className="text-zinc-500">POST …/send</code>
                </div>
                {lastCompose && (lastCompose.errors.length > 0 || lastCompose.warnings.length > 0) ? (
                  <div className="mt-2">
                    <p className="mb-1 text-[9px] uppercase tracking-wider text-zinc-500">
                      Compose messages
                    </p>
                    <pre className="max-h-40 overflow-auto rounded bg-zinc-900/80 p-2 text-[11px] leading-snug text-zinc-400">
                      {JSON.stringify(
                        { errors: lastCompose.errors, warnings: lastCompose.warnings },
                        null,
                        2,
                      )}
                    </pre>
                  </div>
                ) : null}
              </div>
            </details>
          </div>
        </>
      )}
    </section>
  );
}
