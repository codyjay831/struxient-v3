import { InternalSparseState } from "@/components/internal/internal-state-feedback";
import type { QuoteVersionLineItemSummaryDto } from "@/server/slice1/reads/quote-workspace-reads";
import { deriveQuoteLineItemOutcomeBreakdown } from "@/lib/quote-line-item-outcome";

type Props = {
  quoteId: string;
  versionNumber: number | null;
  summary: QuoteVersionLineItemSummaryDto | null;
};

/**
 * Read-only summary of the current quote version's line items and totals.
 *
 * Tiles are outcome-first: contractors see what the customer is buying
 * (Quote-only vs Field work) before the technical breakdown of where the
 * field-work instructions came from (saved template vs one-off).
 */
export function QuoteWorkspaceLineItemSummary({ quoteId, versionNumber, summary }: Props) {
  if (!summary || versionNumber === null) return null;

  const { lineItemCount, libraryLineItemCount, localLineItemCount, totalLineItemCents } = summary;

  const formatCurrency = (cents: number | null) => {
    if (cents === null) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  if (lineItemCount === 0) {
    return (
      <section className="mb-6">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-4">
          What the customer is buying
        </h2>
        <InternalSparseState
          message="No line items yet"
          hint={`Draft v${versionNumber} is empty. Start by writing a custom line or inserting a saved line.`}
          action={{
            href: `/quotes/${quoteId}/scope`,
            label: "Edit line items →",
          }}
        />
      </section>
    );
  }

  const outcomes = deriveQuoteLineItemOutcomeBreakdown({
    lineItemCount,
    libraryLineItemCount,
    localLineItemCount,
  });

  return (
    <section className="mb-6 rounded-lg border border-zinc-800 bg-zinc-900/30 p-5 shadow-sm">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">What the customer is buying</h2>
        <span className="text-[10px] font-medium text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">v{versionNumber}</span>
      </div>

      <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        <div>
          <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-tight">Total line items</p>
          <p className="mt-1 text-xl font-semibold text-zinc-100">{outcomes.total}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-tight">Quote-only</p>
          <p className="mt-1 text-xl font-semibold text-zinc-300">{outcomes.quoteOnly}</p>
          <p className="mt-0.5 text-[10px] text-zinc-500">on the proposal only</p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-tight">Field work</p>
          <p className="mt-1 text-xl font-semibold text-sky-400">{outcomes.fieldWork}</p>
          <p className="mt-0.5 text-[10px] text-zinc-500">create crew tasks after approval</p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-tight">Subtotal</p>
          <p className="mt-1 text-xl font-semibold text-emerald-500/90">{formatCurrency(totalLineItemCents)}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-500">
        <div className="flex items-center gap-2">
          <div className="h-1 w-1 rounded-full bg-zinc-700"></div>
          <span>
            Field work breakdown:{" "}
            <span className="text-zinc-300">{outcomes.fieldWorkSaved}</span> from saved work templates
            {" · "}
            <span className="text-zinc-300">{outcomes.fieldWorkOneOff}</span> one-off
          </span>
        </div>
      </div>
    </section>
  );
}
