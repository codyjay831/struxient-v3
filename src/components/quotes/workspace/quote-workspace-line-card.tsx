"use client";

import Link from "next/link";
import { useState } from "react";
import type { QuoteVersionScopeApiDto } from "@/lib/quote-version-scope-dto";
import type { LineItemExecutionPreviewDto } from "@/lib/quote-line-item-execution-preview";
import type { QuoteLocalPacketDto } from "@/server/slice1/reads/quote-local-packet-reads";
import type { LineComposeBlockerBannerModel } from "@/lib/workspace/quote-workspace-compose-blocker-copy";
import { QuoteWorkspaceCrewTasksSection } from "@/components/quotes/workspace/quote-workspace-crew-tasks-section";
import { QuoteWorkspaceLineEditForm } from "@/components/quotes/workspace/quote-workspace-line-edit-form";

export type QuoteWorkspaceScopeLineRow = QuoteVersionScopeApiDto["orderedLineItems"][number];

type Props = {
  quoteId: string;
  quoteVersionId: string;
  line: QuoteWorkspaceScopeLineRow;
  preview: LineItemExecutionPreviewDto | null | undefined;
  lineTotalCents: number | null | undefined;
  localPacket: QuoteLocalPacketDto | null;
  canAuthorTasks: boolean;
  pinnedWorkflowVersionId: string | null;
  /** Last compose-preview blocking issue(s) for this line (same `quoteVersionId` as workspace). */
  composeBlocker?: LineComposeBlockerBannerModel | null;
};

function formatUsd(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

/**
 * Workspace line card: commercial summary, inline line edit, crew tasks.
 */
export function QuoteWorkspaceLineCard({
  quoteId,
  quoteVersionId,
  line,
  preview,
  lineTotalCents,
  localPacket,
  canAuthorTasks,
  pinnedWorkflowVersionId,
  composeBlocker = null,
}: Props) {
  const [editingLine, setEditingLine] = useState(false);
  const createsCrew = line.executionMode === "MANIFEST";
  /** Option B: guided handoff only — no mutations. Hidden when compose blocker already surfaces a fix link. */
  const showEstimateOnlyCrewHandoff =
    !createsCrew && canAuthorTasks && !editingLine && !composeBlocker;

  return (
    <article
      id={`line-item-${line.id}`}
      className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-4 space-y-2 scroll-mt-6"
    >
      {composeBlocker && !editingLine ? (
        <div
          className="rounded-md border border-amber-900/50 bg-amber-950/25 p-3 space-y-2"
          role="status"
          aria-live="polite"
        >
          <p className="text-xs font-semibold text-amber-100">{composeBlocker.contractorTitle}</p>
          <p className="text-[11px] leading-relaxed text-amber-200/90 whitespace-pre-line">
            {composeBlocker.contractorBody}
          </p>
          <div className="flex flex-col gap-1">
            <Link
              href={composeBlocker.actionHref}
              className="text-[11px] font-semibold text-sky-300 hover:text-sky-200 underline underline-offset-2 w-fit"
            >
              {composeBlocker.actionLabel}
            </Link>
            {composeBlocker.actionHelper ? (
              <p className="text-[10px] leading-snug text-amber-200/75">{composeBlocker.actionHelper}</p>
            ) : null}
          </div>
          {composeBlocker.showTechnicalDetails ? (
            <details className="pt-1 text-[10px] text-zinc-500">
              <summary className="cursor-pointer font-medium text-zinc-400 hover:text-zinc-300">
                Technical details
              </summary>
              <dl className="mt-2 space-y-1.5 rounded border border-zinc-800/80 bg-zinc-950/60 p-2 font-mono text-[10px] text-zinc-400">
                <div>
                  <dt className="text-zinc-600">Code</dt>
                  <dd className="break-words text-zinc-300">{composeBlocker.technicalCode}</dd>
                </div>
                <div>
                  <dt className="text-zinc-600">Message</dt>
                  <dd className="break-words text-zinc-300">{composeBlocker.technicalMessage}</dd>
                </div>
                {composeBlocker.additionalTechnical?.map((row, i) => (
                  <div key={`${row.code}-${i}`} className="border-t border-zinc-800/60 pt-1.5">
                    <dt className="text-zinc-600">{row.code}</dt>
                    <dd className="break-words text-zinc-300">{row.message}</dd>
                  </div>
                ))}
              </dl>
            </details>
          ) : null}
        </div>
      ) : null}

      {editingLine && canAuthorTasks ? (
        <QuoteWorkspaceLineEditForm
          key={`${line.id}-${line.title}-${line.quantity}-${lineTotalCents ?? "x"}`}
          quoteId={quoteId}
          quoteVersionId={quoteVersionId}
          lineItemId={line.id}
          initialTitle={line.title}
          initialQuantity={line.quantity}
          initialDescription={line.description}
          initialLineTotalCents={lineTotalCents ?? null}
          onCancel={() => setEditingLine(false)}
        />
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <h3 className="text-base font-semibold text-zinc-50 leading-snug break-words">{line.title}</h3>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
              <span>
                Qty <span className="font-mono text-zinc-400">{line.quantity}</span>
              </span>
              <span>
                Amount <span className="font-mono text-zinc-400">{formatUsd(lineTotalCents ?? null)}</span>
              </span>
              <span
                className={
                  createsCrew
                    ? "rounded border border-emerald-900/40 bg-emerald-950/20 px-1.5 py-0.5 text-[10px] font-medium text-emerald-200/95"
                    : "rounded border border-zinc-700/60 bg-zinc-900/50 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400"
                }
              >
                {createsCrew ? "Creates crew work" : "Quote only"}
              </span>
            </div>
          </div>
          {canAuthorTasks ? (
            <button
              type="button"
              onClick={() => setEditingLine(true)}
              className="shrink-0 rounded border border-zinc-700/60 bg-transparent px-2 py-1 text-[11px] font-medium text-zinc-500 hover:border-zinc-600 hover:bg-zinc-900/50 hover:text-zinc-300 transition-colors"
            >
              Edit line
            </button>
          ) : null}
        </div>
      )}

      {!editingLine && line.description ? (
        <p className="text-xs text-zinc-500 leading-relaxed border-t border-zinc-800/60 pt-2 mt-1">
          {line.description}
        </p>
      ) : null}

      {showEstimateOnlyCrewHandoff ? (
        <div
          className="rounded-md border border-zinc-800/70 bg-zinc-900/35 p-3 space-y-2"
          aria-label="Crew task setup for this line"
        >
          <p className="text-xs font-semibold text-zinc-200">Add crew tasks</p>
          <p className="text-[11px] leading-relaxed text-zinc-400">
            Use this when this line should include internal crew work after the quote is approved.
          </p>
          <p className="text-[10px] leading-snug text-zinc-500">
            This line stays estimate-only until crew tasks or saved work are added.
          </p>
          <Link
            href={`/quotes/${quoteId}#line-item-${line.id}`}
            className="inline-flex text-[11px] font-semibold text-sky-400/90 hover:text-sky-300 underline underline-offset-2 w-fit"
          >
            Set up crew tasks on this line
          </Link>
        </div>
      ) : null}

      {createsCrew ? (
        <QuoteWorkspaceCrewTasksSection
          quoteId={quoteId}
          quoteVersionId={quoteVersionId}
          lineItemId={line.id}
          lineTitle={line.title}
          executionMode={line.executionMode}
          preview={preview}
          quoteLocalPacketId={line.quoteLocalPacketId}
          scopePacketRevisionId={line.scopePacketRevisionId}
          localPacket={localPacket}
          canAuthorTasks={canAuthorTasks}
          pinnedWorkflowVersionId={pinnedWorkflowVersionId}
        />
      ) : null}
    </article>
  );
}
