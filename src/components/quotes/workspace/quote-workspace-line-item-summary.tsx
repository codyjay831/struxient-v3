import { InternalSparseState } from "@/components/internal/internal-state-feedback";
import type { QuoteVersionLineItemSummaryDto } from "@/server/slice1/reads/quote-workspace-reads";

type Props = {
  versionNumber: number | null;
  summary: QuoteVersionLineItemSummaryDto | null;
};

/**
 * Read-only summary of the current quote version's line items and totals.
 */
export function QuoteWorkspaceLineItemSummary({ versionNumber, summary }: Props) {
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
          Scope summary
        </h2>
        <InternalSparseState
          message="No line items added yet"
          hint={`This version (v${versionNumber}) is currently empty.`}
        />
      </section>
    );
  }

  return (
    <section className="mb-6 rounded-lg border border-zinc-800 bg-zinc-900/30 p-5 shadow-sm">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Current version contents</h2>
        <span className="text-[10px] font-medium text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">v{versionNumber}</span>
      </div>

      <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        <div>
          <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-tight">Total items</p>
          <p className="mt-1 text-xl font-semibold text-zinc-100">{lineItemCount}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-tight">Scope subtotal</p>
          <p className="mt-1 text-xl font-semibold text-emerald-500/90">{formatCurrency(totalLineItemCents)}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-tight">Library scope</p>
          <p className="mt-1 text-sm font-medium text-zinc-300">{libraryLineItemCount} items</p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-tight">Local scope</p>
          <p className="mt-1 text-sm font-medium text-zinc-300">{localLineItemCount} items</p>
        </div>
      </div>
      
      <div className="mt-5 flex items-center gap-2 text-[11px] text-zinc-500">
        <div className="h-1 w-1 rounded-full bg-zinc-700"></div>
        {libraryLineItemCount > 0 ? (
          <p>Standardized library packets provide {((libraryLineItemCount / lineItemCount) * 100).toFixed(0)}% of current scope.</p>
        ) : (
          <p>This version uses 100% quote-local scope.</p>
        )}
      </div>
    </section>
  );
}
