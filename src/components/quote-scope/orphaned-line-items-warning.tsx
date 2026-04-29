/**
 * Shown when grouped scope line items include rows whose proposal group id
 * does not match any proposal group on the quote version (data inconsistency).
 */
export function OrphanedLineItemsWarning({ count }: { count: number }) {
  return (
    <section className="mb-6 rounded-lg border border-red-900/60 bg-red-950/20 p-4 text-xs leading-relaxed text-red-200">
      <p className="text-[11px] font-semibold uppercase tracking-wide">
        Quote line data inconsistency · {count} orphaned line item{count === 1 ? "" : "s"}
      </p>
      <p className="mt-1 opacity-90">
        {count === 1 ? "One line item references" : `${count} line items reference`} a proposal group not present in
        this version. {count === 1 ? "It is" : "They are"} intentionally not rendered below so the inconsistency stays
        visible.
      </p>
    </section>
  );
}
