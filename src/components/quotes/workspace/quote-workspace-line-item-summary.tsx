import type { QuoteVersionLineItemSummaryDto } from "@/server/slice1/reads/quote-workspace-reads";
import { deriveQuoteLineItemOutcomeBreakdown } from "@/lib/quote-line-item-outcome";

type Props = {
  versionNumber: number | null;
  summary: QuoteVersionLineItemSummaryDto | null;
};

/**
 * Read-only supportive totals for the head version (counts + subtotal).
 * Primary line-by-line context lives in {@link QuoteWorkspaceLineItemList}.
 */
export function QuoteWorkspaceLineItemSummary({ versionNumber, summary }: Props) {
  if (!summary || versionNumber === null) return null;

  const { lineItemCount, libraryLineItemCount, localLineItemCount, totalLineItemCents } = summary;

  /** Empty draft: primary empty state + CTA live on the line item list. */
  if (lineItemCount === 0) return null;

  const formatCurrency = (cents: number | null) => {
    if (cents === null) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  const outcomes = deriveQuoteLineItemOutcomeBreakdown({
    lineItemCount,
    libraryLineItemCount,
    localLineItemCount,
  });

  return (
    <section className="mb-4 rounded-md border border-zinc-800/80 bg-zinc-950/40 px-3 py-3 sm:px-4">
      <div className="mb-3 flex items-center justify-between border-b border-zinc-800/80 pb-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Line item summary</h2>
        <span className="text-xs font-medium tabular-nums text-zinc-500">v{versionNumber}</span>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-tight text-zinc-500">Total lines</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-100">{outcomes.total}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-tight text-zinc-500">Proposal only</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-300">{outcomes.quoteOnly}</p>
          <p className="mt-0.5 text-xs text-zinc-600">No crew work from this line</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-tight text-zinc-500">With crew work</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-sky-400/90">{outcomes.fieldWork}</p>
          <p className="mt-0.5 text-xs text-zinc-600">Internal work tied to quote lines</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-tight text-zinc-500">Subtotal</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-emerald-500/90">{formatCurrency(totalLineItemCents)}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-600">
        <span>
          Internal crew tasks: <span className="text-zinc-400 tabular-nums">{outcomes.fieldWorkSaved}</span> from saved
          work · <span className="text-zinc-400 tabular-nums">{outcomes.fieldWorkOneOff}</span> custom on this quote
        </span>
      </div>
    </section>
  );
}
