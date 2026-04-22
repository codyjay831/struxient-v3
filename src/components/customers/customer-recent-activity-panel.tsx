import type { CustomerRecentActivityItemDto } from "@/server/slice1";

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 16).replace("T", " ");
}

function kindLabel(kind: CustomerRecentActivityItemDto["kind"]): string {
  switch (kind) {
    case "NOTE_ADDED":
      return "Note added";
    case "NOTE_UPDATED":
      return "Note updated";
    case "CONTACT_ADDED":
      return "Contact added";
    case "CONTACT_UPDATED":
      return "Contact updated";
    default:
      return "Activity";
  }
}

type Props = {
  customerId: string;
  items: CustomerRecentActivityItemDto[];
};

export function CustomerRecentActivityPanel({ customerId, items }: Props) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-5" aria-labelledby={`recent-activity-${customerId}`}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={`recent-activity-${customerId}`} className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Recent activity (summary)
        </h2>
      </div>
      <p className="mb-4 text-xs leading-relaxed text-zinc-500">
        Newest first. Includes{" "}
        <strong className="font-medium text-zinc-400">active notes</strong> and{" "}
        <strong className="font-medium text-zinc-400">active contacts</strong> using stored timestamps only — not a full
        audit trail, and not quote or project history.
      </p>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950/30 p-4 text-sm text-zinc-500">
          No recent note or contact activity yet.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-800/80 border border-zinc-800/80 rounded-lg overflow-hidden">
          {items.map((row, idx) => (
            <li key={`${row.kind}-${row.noteId ?? row.contactId}-${row.occurredAtIso}-${idx}`} className="bg-zinc-950/20 px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-sky-400/90">{kindLabel(row.kind)}</span>
                <time className="text-[11px] font-mono text-zinc-500" dateTime={row.occurredAtIso}>
                  {formatWhen(row.occurredAtIso)}
                </time>
              </div>
              <p className="mt-1 text-sm text-zinc-300">{row.summaryText}</p>
              {row.actorLabel != null && row.kind === "NOTE_ADDED" ? (
                <p className="mt-1 text-[11px] text-zinc-500">By {row.actorLabel}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
