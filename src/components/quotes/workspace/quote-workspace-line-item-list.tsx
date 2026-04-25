import type { QuoteLineItemVisibilityDto } from "@/server/slice1/reads/quote-workspace-reads";
import {
  deriveQuoteLineItemOutcome,
  formatQuoteLineItemOutcomeLabel,
  type QuoteLineItemOutcome,
} from "@/lib/quote-line-item-outcome";

type Props = {
  versionNumber: number | null;
  items: QuoteLineItemVisibilityDto[];
};

export function QuoteWorkspaceLineItemList({ versionNumber, items }: Props) {
  const formatCurrency = (cents: number | null) => {
    if (cents === null) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  if (items.length === 0) {
    // The summary card already shows the "no line items yet" empty state with
    // a CTA. Suppress this duplicate to keep Step 1 focused.
    return null;
  }

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-4 border-b border-zinc-800 pb-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Quote line items
        </h2>
        <span className="text-[10px] font-medium text-zinc-500 uppercase">
          {items.length} {items.length === 1 ? "Item" : "Items"}
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/20">
        <table className="w-full text-left text-xs text-zinc-300">
          <thead className="bg-zinc-900/60 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-4 py-2">Line title</th>
              <th className="px-4 py-2 text-right">Qty</th>
              <th className="px-4 py-2 text-right">Amount</th>
              <th className="px-4 py-2 text-center">What this creates</th>
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

      <p className="mt-3 text-[10px] text-zinc-500 italic">
        Read-only view for v{versionNumber}. Edit line items from the Build the quote step.
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
