import Link from "next/link";
import type { QuoteVersionHistoryItemDto } from "@/server/slice1/reads/quote-version-history-reads";
import { QuoteWorkspaceVersionStatusBadge } from "./quote-workspace-version-status-badge";

type Props = {
  versions: QuoteVersionHistoryItemDto[];
};

function shortId(id: string): string {
  return `${id.slice(0, 8)}…`;
}

/**
 * Compact version history for office scanning; raw JSON behind disclosure per row.
 */
export function QuoteWorkspaceVersionHistory({ versions }: Props) {
  return (
    <section aria-labelledby="version-history-heading" className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="version-history-heading" className="text-sm font-semibold text-zinc-200">
          Revision history
        </h2>
        <span className="text-[10px] font-medium uppercase tracking-tight text-zinc-500">
          {versions.length} {versions.length === 1 ? "Version" : "Versions"} total
        </span>
      </div>
      <p className="mb-4 text-xs text-zinc-500 italic">Full record of all commercial revisions for this quote. Main workspace actions always apply to the current version.</p>

      <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/40">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/50 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              <th className="px-3 py-2">Revision</th>
              <th className="px-3 py-2">Status</th>
              <th className="hidden px-3 py-2 sm:table-cell">Context</th>
              <th className="px-3 py-2 text-center">Actions</th>
              <th className="px-3 py-2 text-right">Reference</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/90">
            {versions.map((v, idx) => {
              const isHead = idx === 0;
              return (
                <tr key={v.id} className={`group text-zinc-300 hover:bg-zinc-900/30 transition-colors ${isHead ? "bg-zinc-900/20" : ""}`}>
                  <td className="whitespace-nowrap px-3 py-3 font-medium text-zinc-100">
                    <div className="flex items-center gap-2">
                      Version {v.versionNumber}
                      {isHead && (
                        <span className="rounded bg-sky-950/40 border border-sky-800/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-sky-400">
                          Current
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <QuoteWorkspaceVersionStatusBadge status={v.status} />
                  </td>
                  <td className="hidden max-w-[12rem] px-3 py-3 text-[11px] text-zinc-500 sm:table-cell">
                    <div className="flex flex-wrap gap-1.5">
                      {v.hasPinnedWorkflow && <span className="rounded border border-zinc-800 bg-zinc-900 px-1 py-0.5 text-[10px] text-zinc-400">Workflow</span>}
                      {v.hasFrozenArtifacts && <span className="rounded border border-zinc-800 bg-zinc-900 px-1 py-0.5 text-[10px] text-zinc-400">Frozen</span>}
                      {v.hasActivation && <span className="rounded border border-emerald-900/20 bg-emerald-950/20 px-1 py-0.5 text-[10px] text-emerald-400/90 font-medium uppercase tracking-tight">Active</span>}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <Link
                      href={`/dev/quote-scope/${v.id}`}
                      className={`inline-block rounded px-2 py-1 text-xs font-medium transition-colors ${
                        isHead
                          ? "bg-sky-900/20 text-sky-400 border border-sky-800/30 hover:bg-sky-800/30"
                          : "text-zinc-400 hover:text-zinc-100 bg-zinc-800/40 hover:bg-zinc-800 border border-transparent"
                      }`}
                    >
                      View scope
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-right relative">
                    <details className="inline-block text-left">
                      <summary className="cursor-pointer select-none text-[10px] text-zinc-600 hover:text-zinc-500 group-hover:text-zinc-400 transition-colors">
                        Technical
                      </summary>
                      <ul className="absolute right-0 z-10 mt-1 space-y-1 rounded border border-zinc-800 bg-zinc-950/95 p-2 text-left font-mono text-[10px] text-zinc-500 min-w-[180px] shadow-xl shadow-black/40">
                        <li className="break-all border-b border-zinc-800 pb-1 mb-1 text-zinc-400">ID: {v.id}</li>
                        <li>
                          <Link href={`/api/quote-versions/${v.id}/lifecycle`} className="text-sky-500/90 hover:text-sky-400 underline decoration-sky-900/40">
                            Lifecycle JSON
                          </Link>
                        </li>
                        <li>
                          <Link href={`/api/quote-versions/${v.id}/freeze`} className="text-sky-500/90 hover:text-sky-400 underline decoration-sky-900/40">
                            Freeze JSON
                          </Link>
                        </li>
                      </ul>
                    </details>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
