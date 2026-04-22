import Link from "next/link";
import type { QuoteWorkspacePreJobTaskDto } from "@/server/slice1/reads/quote-workspace-reads";

type Props = {
  flowGroupName: string;
  tasks: QuoteWorkspacePreJobTaskDto[];
};

/**
 * Read-only visibility for `PreJobTask` rows on the quote's FlowGroup.
 * Does not imply scheduling or a full pre-construction product surface.
 */
export function QuoteWorkspacePreJobTasks({ flowGroupName, tasks }: Props) {
  return (
    <section
      className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-6"
      aria-labelledby="prejob-workspace-heading"
    >
      <div className="mb-4 border-b border-zinc-800 pb-4">
        <h3 id="prejob-workspace-heading" className="text-sm font-bold uppercase tracking-wider text-zinc-500">
          Pre-job tasks
        </h3>
        <p className="text-xs text-zinc-600 mt-1 leading-relaxed">
          Recorded against <span className="text-zinc-400">{flowGroupName}</span> (same site as this quote). Shown for
          context only — not a schedule or field-operations console.
        </p>
      </div>

      {tasks.length === 0 ? (
        <p className="text-xs text-zinc-500 leading-relaxed">
          No pre-job tasks on file for this site. If your team adds them elsewhere, they will appear here.
        </p>
      ) : (
        <ul className="space-y-3">
          {tasks.map((t) => (
            <li
              key={t.id}
              className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-3 py-2.5 text-xs text-zinc-300"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2 gap-y-1">
                <span className="font-medium text-zinc-200">{t.title}</span>
                <span className="font-mono text-[10px] uppercase tracking-wide text-zinc-500">{t.status}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-zinc-500">
                <span>
                  Type <span className="font-mono text-zinc-400">{t.taskType}</span> ·{" "}
                  <span className="font-mono text-zinc-400">{t.sourceType}</span>
                </span>
                {t.linkedQuoteVersionNumber != null && (
                  <span>
                    This quote ·{" "}
                    {t.quoteVersionScopeHref ? (
                      <Link href={t.quoteVersionScopeHref} className="text-sky-500 hover:underline">
                        v{t.linkedQuoteVersionNumber}
                      </Link>
                    ) : (
                      <span className="text-zinc-400">v{t.linkedQuoteVersionNumber}</span>
                    )}
                  </span>
                )}
                {t.quoteVersionId != null && t.linkedQuoteVersionNumber == null && (
                  <span className="text-zinc-500">Linked to another quote on this site</span>
                )}
                {t.quoteVersionId == null && <span className="text-zinc-500">Site-level (no quote version link)</span>}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-zinc-600">
                {t.assignedToLabel != null && <span>Assignee: {t.assignedToLabel}</span>}
                {t.dueAtIso != null && (
                  <span>
                    Due: <span className="font-mono text-zinc-500">{t.dueAtIso}</span>
                  </span>
                )}
                <span>
                  Created: <span className="font-mono text-zinc-500">{t.createdAtIso}</span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
