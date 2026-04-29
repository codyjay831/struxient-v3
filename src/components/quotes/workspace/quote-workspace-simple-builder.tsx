"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { QuoteVersionScopeApiDto } from "@/lib/quote-version-scope-dto";
import type { LineItemExecutionPreviewDto } from "@/lib/quote-line-item-execution-preview";
import type { QuoteLineItemVisibilityDto } from "@/server/slice1/reads/quote-workspace-reads";
import type { QuoteLocalPacketDto } from "@/server/slice1/reads/quote-local-packet-reads";
import type { ScopeProposalGroupWithItems } from "@/lib/quote-scope/quote-scope-grouping";
import {
  QuoteWorkspaceLineCard,
  type QuoteWorkspaceScopeLineRow,
} from "@/components/quotes/workspace/quote-workspace-line-card";
import { QuoteWorkspaceLineCreateForm } from "@/components/quotes/workspace/quote-workspace-line-create-form";
import { useQuoteWorkspaceComposePreview } from "@/components/quotes/workspace/quote-workspace-compose-preview-context";
import {
  buildLineComposeBlockerBanner,
  groupComposeBlockingErrorsByLineItemId,
  type LineComposeBlockerBannerModel,
} from "@/lib/workspace/quote-workspace-compose-blocker-copy";

type GroupWithLines = ScopeProposalGroupWithItems<
  QuoteVersionScopeApiDto["proposalGroups"][number],
  QuoteWorkspaceScopeLineRow
>;

type Props = {
  quoteId: string;
  quoteVersionId: string;
  groupsWithItems: GroupWithLines[];
  orphanedItems: QuoteWorkspaceScopeLineRow[];
  headLineItems: QuoteLineItemVisibilityDto[];
  executionPreviewByLineItemId: Record<string, LineItemExecutionPreviewDto> | null;
  localPackets: QuoteLocalPacketDto[];
  canAuthorTasks: boolean;
  pinnedWorkflowVersionId: string | null;
};

function lineTotalById(headLineItems: QuoteLineItemVisibilityDto[]): Map<string, number | null> {
  const m = new Map<string, number | null>();
  for (const row of headLineItems) {
    m.set(row.id, row.lineTotalCents);
  }
  return m;
}

function localPacketById(packets: QuoteLocalPacketDto[]): Map<string, QuoteLocalPacketDto> {
  const m = new Map<string, QuoteLocalPacketDto>();
  for (const p of packets) {
    m.set(p.id, p);
  }
  return m;
}

/**
 * Workspace line-first shell: line cards + crew tasks (+ Add task: existing list or first-task setup).
 */
export function QuoteWorkspaceSimpleBuilder({
  quoteId,
  quoteVersionId,
  groupsWithItems,
  orphanedItems,
  headLineItems,
  executionPreviewByLineItemId,
  localPackets,
  canAuthorTasks,
  pinnedWorkflowVersionId,
}: Props) {
  const totals = lineTotalById(headLineItems);
  const packets = localPacketById(localPackets);
  const previews = executionPreviewByLineItemId ?? {};
  const { lastCompose } = useQuoteWorkspaceComposePreview();

  const composeBlockerByLineId = useMemo(() => {
    const out: Record<string, LineComposeBlockerBannerModel> = {};
    if (!lastCompose || lastCompose.quoteVersionId !== quoteVersionId) return out;
    const grouped = groupComposeBlockingErrorsByLineItemId(lastCompose.errors);
    for (const [lineId, errs] of Object.entries(grouped)) {
      const banner = buildLineComposeBlockerBanner(quoteId, lineId, errs);
      if (banner) out[lineId] = banner;
    }
    return out;
  }, [lastCompose, quoteId, quoteVersionId]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-500 leading-relaxed">
        Add quote lines here with + Add line item — estimate-only lines with quantity and unit price. Build saved work
        and crew tasks from{" "}
        <Link href={`/quotes/${quoteId}#step-1`} className="font-medium text-sky-400/90 hover:text-sky-300">
          step 1
        </Link>{" "}
        on the quote workspace when the full editor is shown there. Optional:{" "}
        <Link href={`/quotes/${quoteId}/scope`} className="font-medium text-sky-400/90 hover:text-sky-300">
          focused Line &amp; tasks view
        </Link>{" "}
        for a full-page layout.
      </p>

      <QuoteWorkspaceLineCreateForm
        quoteId={quoteId}
        quoteVersionId={quoteVersionId}
        groupsWithItems={groupsWithItems}
        canAddLineItems={canAuthorTasks}
      />

      {groupsWithItems.map((group) => (
        <section key={group.id} className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-800/70 pb-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{group.name}</h2>
            <span className="text-[10px] text-zinc-600">
              {group.items.length} {group.items.length === 1 ? "line" : "lines"}
            </span>
          </div>
          <div className="space-y-3">
            {group.items.map((line) => (
              <QuoteWorkspaceLineCard
                key={line.id}
                quoteId={quoteId}
                quoteVersionId={quoteVersionId}
                line={line}
                preview={previews[line.id]}
                lineTotalCents={totals.get(line.id)}
                localPacket={
                  line.quoteLocalPacketId ? packets.get(line.quoteLocalPacketId) ?? null : null
                }
                canAuthorTasks={canAuthorTasks}
                pinnedWorkflowVersionId={pinnedWorkflowVersionId}
                composeBlocker={composeBlockerByLineId[line.id] ?? null}
              />
            ))}
          </div>
        </section>
      ))}

      {orphanedItems.length > 0 ? (
        <section className="rounded-md border border-amber-900/40 bg-amber-950/15 p-3 space-y-2">
          <p className="text-xs font-semibold text-amber-200">Ungrouped lines</p>
          <p className="text-[11px] text-amber-200/85">
            These lines are not in a proposal group the UI recognized. Review them in{" "}
            <Link href={`/quotes/${quoteId}#step-1`} className="underline font-medium text-amber-100">
              step 1
            </Link>{" "}
            or the{" "}
            <Link href={`/quotes/${quoteId}/scope`} className="underline font-medium text-amber-100">
              focused view
            </Link>
            .
          </p>
          <div className="space-y-3">
            {orphanedItems.map((line) => (
              <QuoteWorkspaceLineCard
                key={line.id}
                quoteId={quoteId}
                quoteVersionId={quoteVersionId}
                line={line}
                preview={previews[line.id]}
                lineTotalCents={totals.get(line.id)}
                localPacket={
                  line.quoteLocalPacketId ? packets.get(line.quoteLocalPacketId) ?? null : null
                }
                canAuthorTasks={canAuthorTasks}
                pinnedWorkflowVersionId={pinnedWorkflowVersionId}
                composeBlocker={composeBlockerByLineId[line.id] ?? null}
              />
            ))}
          </div>
        </section>
      ) : null}

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 pt-1 text-[10px] text-zinc-500">
        <Link
          href={`/quotes/${quoteId}/scope`}
          className="text-xs font-semibold text-sky-300 hover:text-sky-200 underline underline-offset-2"
        >
          Focused Line &amp; tasks view
        </Link>
        <span>Optional full-page layout — same tools as step 1 when the full editor is on the quote workspace.</span>
      </div>
    </div>
  );
}
