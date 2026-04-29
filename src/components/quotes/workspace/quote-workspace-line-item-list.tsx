import { InternalSparseState } from "@/components/internal/internal-state-feedback";
import type { QuoteLineItemVisibilityDto } from "@/server/slice1/reads/quote-workspace-reads";
import {
  deriveQuoteLineItemOutcome,
  formatQuoteLineItemOutcomeLabel,
  type QuoteLineItemOutcome,
} from "@/lib/quote-line-item-outcome";

type Props = {
  quoteId: string;
  versionNumber: number | null;
  items: QuoteLineItemVisibilityDto[];
};

export function QuoteWorkspaceLineItemList({ quoteId, versionNumber, items }: Props) {
  const formatCurrency = (cents: number | null) => {
    if (cents === null) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  if (versionNumber === null) {
    return null;
  }

  if (items.length === 0) {
    return (
      <section className="mb-6">
        <div className="mb-4 flex items-center justify-between border-b border-zinc-800 pb-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Quote line items</h2>
        </div>
        <InternalSparseState
          message="No line items yet"
          hint={`Draft v${versionNumber} is empty. This summary is read-only when the full editor is not available in step 1. Use the focused Line & tasks view to add or edit lines, saved work, and crew tasks, or resolve permissions and reload the quote workspace.`}
          action={{
            href: `/quotes/${quoteId}/scope`,
            label: "Focused Line & tasks view",
          }}
        />
      </section>
    );
  }

  return (
    <section className="mb-6">
      <div className="mb-4 flex items-center justify-between border-b border-zinc-800 pb-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Quote line items</h2>
        <span className="text-[10px] font-medium text-zinc-500 uppercase">
          {items.length} {items.length === 1 ? "line" : "lines"}
        </span>
      </div>

      <p className="mb-3 text-xs leading-relaxed text-zinc-400">
        These are the lines the customer will see. Estimate-only lines stay on the proposal until you add crew tasks
        later for lines that include crew work.
      </p>

      <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/30">
        <table className="w-full text-left text-xs text-zinc-300">
          <thead className="bg-zinc-900/60 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-4 py-2">Line title</th>
              <th className="px-4 py-2 text-right">Qty</th>
              <th className="px-4 py-2 text-right">Amount</th>
              <th className="px-4 py-2 text-center">After approval</th>
            </tr>
          </thead>
          <tbody className="divide-y border-zinc-800">
            {items.map((item) => {
              const outcome = deriveQuoteLineItemOutcome({
                isLibraryBacked: item.isLibraryBacked,
                isQuoteLocal: item.isQuoteLocal,
              });
              return (
                <tr key={item.id} className="hover:bg-zinc-800/40 transition-colors">
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-zinc-200">{item.title}</p>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-zinc-400">
                    {item.quantity}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-zinc-100">
                    {formatCurrency(item.lineTotalCents)}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <OutcomeChip outcome={outcome} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[10px] text-zinc-500">
        Read-only summary for v{versionNumber}. When the full editor is open in step 1, add or edit lines there. The
        focused Line & tasks view is optional for the same tools in a full-page layout.
      </p>
    </section>
  );
}

function OutcomeChip({ outcome }: { outcome: QuoteLineItemOutcome }) {
  const label = formatQuoteLineItemOutcomeLabel(outcome);
  const className =
    outcome === "quote_only"
      ? "border border-zinc-700/60 bg-zinc-800/30 text-zinc-400"
      : outcome === "field_work_saved"
        ? "border border-sky-800/60 bg-sky-950/30 text-sky-400"
        : "border border-amber-800/60 bg-amber-950/30 text-amber-300";
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${className}`}
    >
      {label}
    </span>
  );
}
