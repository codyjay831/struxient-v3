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
      <h2 id="version-history-heading" className="mb-3 text-sm font-semibold text-zinc-200">
        Revision history
      </h2>
      <p className="mb-4 text-xs text-zinc-500 italic">Full record of all commercial revisions for this quote.</p>

      <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/40">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/50 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              <th className="px-3 py-2">Revision</th>
              <th className="px-3 py-2">Status</th>
              <th className="hidden px-3 py-2 sm:table-cell">Flags</th>
              <th className="px-3 py-2">Scope</th>
              <th className="px-3 py-2 text-right">Reference</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/90">
            {versions.map((v) => (
              <tr key={v.id} className="text-zinc-300 hover:bg-zinc-900/30 transition-colors">
                <td className="whitespace-nowrap px-3 py-3 font-medium text-zinc-100">Version {v.versionNumber}</td>
                <td className="px-3 py-3">
                  <QuoteWorkspaceVersionStatusBadge status={v.status} />
                </td>
                <td className="hidden max-w-[12rem] px-3 py-3 text-[11px] text-zinc-500 sm:table-cell">
                  <div className="flex flex-wrap gap-1.5">
                    {v.hasPinnedWorkflow && <span className="rounded bg-zinc-800 px-1 py-0.5 text-zinc-400">Workflow</span>}
                    {v.hasFrozenArtifacts && <span className="rounded bg-zinc-800 px-1 py-0.5 text-zinc-400">Frozen</span>}
                    {v.hasActivation && <span className="rounded bg-zinc-800 px-1 py-0.5 text-zinc-400">Active</span>}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <Link href={`/dev/quote-scope/${v.id}`} className="text-sky-400 hover:text-sky-300 text-xs font-medium">
                    View scope
                  </Link>
                </td>
                <td className="px-3 py-3 text-right">
                  <details className="inline-block text-left">
                    <summary className="cursor-pointer select-none text-[10px] text-zinc-600 hover:text-zinc-500">
                      Technical
                    </summary>
                    <ul className="mt-2 space-y-1 rounded border border-zinc-800 bg-zinc-950/90 p-2 text-left font-mono text-[10px] text-zinc-500 min-w-[180px]">
                      <li className="break-all border-b border-zinc-800 pb-1 mb-1 text-zinc-400">ID: {v.id}</li>
                      <li>
                        <Link href={`/api/quote-versions/${v.id}/lifecycle`} className="text-sky-500/90 hover:text-sky-400 underline">
                          Lifecycle JSON
                        </Link>
                      </li>
                      <li>
                        <Link href={`/api/quote-versions/${v.id}/freeze`} className="text-sky-500/90 hover:text-sky-400 underline">
                          Freeze JSON
                        </Link>
                      </li>
                    </ul>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
