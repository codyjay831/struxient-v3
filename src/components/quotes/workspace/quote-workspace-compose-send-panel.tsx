"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { InternalActionResult } from "@/components/internal/internal-action-result";
import { composeSendProposalDisabledReason } from "@/lib/workspace/quote-workspace-send-disabled-reason";

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
  const [result, setResult] = useState<{
    kind: "success" | "error";
    title: string;
    message?: string;
    technicalDetails?: string;
  } | null>(null);
  /** Token from the last successful compose HTTP response (`data.stalenessToken`); required body field for send. */
  const [stalenessTokenForSend, setStalenessTokenForSend] = useState<string | null | undefined>(undefined);
  const [lastCompose, setLastCompose] = useState<ComposePreviewData | null>(null);

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
      const errorMessages = body.data.errors.map((e) => e.message).filter(Boolean);
      setResult({
        kind: hasErrors ? "error" : "success",
        title: hasErrors ? "Preview found blocking errors" : "Preview generated",
        message: hasErrors
          ? errorMessages.length > 0
            ? errorMessages.join(" ")
            : `There are ${body.data.errors.length} issue(s) that must be fixed before this proposal can be sent.`
          : "The proposal looks valid. You can send it to the customer.",
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
        message:
          "Run Preview proposal first. Sending needs a successful preview so we know this version is up to date.",
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
        const composeMessages =
          body.error?.composeErrors?.map((e) => e.message).filter(Boolean) ?? [];
        const primaryMessage =
          composeMessages.length > 0
            ? composeMessages.join(" ")
            : (body.error?.message ?? "An error occurred while sending the proposal.");
        const codes = body.error?.composeErrors?.map((e) => e.code).join(", ") ?? body.error?.code ?? "ERROR";
        setResult({
          kind: "error",
          title: "Send failed",
          message: primaryMessage,
          technicalDetails: `${codes}: ${res.status}`,
        });
        return;
      }
      setResult({
        kind: "success",
        title: "Proposal sent",
        message:
          "The proposal has been locked and sent to the customer. This version is now waiting for a formal signature.",
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

  const sendDisabledReason = useMemo(() => {
    if (!latestDraft || !canOfficeMutate) return null;
    return composeSendProposalDisabledReason({
      hasPinnedWorkflow: latestDraft.hasPinnedWorkflow,
      hasLastCompose: lastCompose != null,
      composeBlocking,
      stalenessTokenForSendDefined: stalenessTokenForSend !== undefined,
    });
  }, [latestDraft, canOfficeMutate, lastCompose, composeBlocking, stalenessTokenForSend]);

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
        Review the proposal for v{latestDraft.versionNumber} and send it to the customer.
      </p>

      {!canOfficeMutate ? (
        <p className="mt-2 text-xs text-zinc-500">
          Preparing and sending proposals requires an office session with elevated permissions.
        </p>
      ) : (
        <>
          {!latestDraft.hasPinnedWorkflow ? (
            <p className="mt-2 text-xs text-amber-700/90">
              <span className="font-medium text-amber-600/90">Work plan not ready.</span> The proposed execution flow
              isn&apos;t attached yet. You can still run Preview proposal to check line items, but send stays disabled
              until the system finishes attaching the plan.
            </p>
          ) : null}

          <p className="mt-3 text-[11px] text-zinc-400 leading-relaxed">
            Sending locks this version. The customer will see this scope and work plan, and you will not be able to
            edit this version after sending.
          </p>

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
                !sendReady
                  ? (!latestDraft.hasPinnedWorkflow
                      ? "Work plan not ready — the system should attach it shortly."
                      : !lastCompose
                        ? "Run preview to verify content."
                        : composeBlocking
                          ? "Fix blocking errors before sending."
                          : "Run preview again to refresh.")
                  : undefined
              }
              onClick={() => void runSend()}
              className="rounded bg-rose-900/80 px-4 py-1.5 text-xs font-medium text-rose-50 hover:bg-rose-800/90 disabled:opacity-40 transition-colors"
            >
              {sendBusy ? "Sending…" : "Send proposal"}
            </button>
          </div>

          {!sendReady && sendDisabledReason ? (
            <p className="mt-3 text-xs text-amber-200/90 leading-relaxed" role="status">
              <span className="font-medium text-amber-100/95">Why Send is disabled: </span>
              {sendDisabledReason}
            </p>
          ) : null}

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

          <div className="mt-4 border-t border-zinc-800/40 pt-3">
            <details className="text-[10px] text-zinc-600">
              <summary className="cursor-pointer font-medium hover:text-zinc-500">Advanced (support)</summary>
              <div className="mt-2 space-y-2">
                <p>
                  Version ID: <span className="font-mono">{latestDraft.quoteVersionId}</span>
                </p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono">
                  <code className="text-zinc-500">POST …/compose-preview</code>
                  <code className="text-zinc-500">POST …/send</code>
                </div>
                {lastCompose ? (
                  <div className="mt-2 space-y-1 text-[11px] text-zinc-500">
                    <p>
                      Preview freshness: <span className="text-zinc-400">{lastCompose.staleness}</span>
                    </p>
                    <p>
                      Server preview id (for support):{" "}
                      <code className="break-all text-zinc-400">
                        {lastCompose.stalenessToken === null ? "none" : (lastCompose.stalenessToken ?? "—")}
                      </code>
                    </p>
                    <p>
                      Line items: {lastCompose.stats.lineItemCount}, plan tasks: {lastCompose.stats.planTaskCount},
                      package tasks: {lastCompose.stats.packageTaskCount}, skeleton slots:{" "}
                      {lastCompose.stats.skeletonSlotCount}, sold slots: {lastCompose.stats.soldSlotCount}
                    </p>
                    {lastCompose.errors.length > 0 || lastCompose.warnings.length > 0 ? (
                      <div className="mt-2">
                        <p className="mb-1 text-[9px] uppercase tracking-wider text-zinc-500">Compose diagnostics</p>
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
                ) : null}
              </div>
            </details>
          </div>
        </>
      )}
    </section>
  );
}
