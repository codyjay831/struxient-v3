import Link from "next/link";
import type { QuoteVersionHistoryItemDto } from "@/server/slice1/reads/quote-version-history-reads";
import {
  quoteVersionCompareToPriorPlain,
  quoteVersionCompareToPriorTechnical,
} from "@/lib/workspace/quote-version-compare-copy";
import { QuoteWorkspaceVersionStatusBadge } from "./quote-workspace-version-status-badge";
import { QuoteVersionVoidControl } from "./quote-version-void-control";

type Props = {
  quoteId: string;
  versions: QuoteVersionHistoryItemDto[];
  canOfficeMutate: boolean;
};

function shortId(id: string): string {
  return `${id.slice(0, 8)}…`;
}

/**
 * Compact version history for office scanning; raw JSON behind disclosure per row.
 * Epic 14: line counts for minimal compare; void control for SENT (no activation) / non-only DRAFT.
 */
export function QuoteWorkspaceVersionHistory({ quoteId, versions, canOfficeMutate }: Props) {
  return (
    <section id="revision-history" aria-labelledby="version-history-heading" className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="version-history-heading" className="text-sm font-semibold text-zinc-200">
          Revision history
        </h2>
        <span className="text-[10px] font-medium uppercase tracking-tight text-zinc-500">
          {versions.length} {versions.length === 1 ? "Version" : "Versions"} total
        </span>
      </div>
      <p className="mb-4 text-xs text-zinc-500 italic">
        Full record of commercial revisions. <span className="font-medium text-zinc-400">Superseded</span> means a
        newer version was sent; <span className="font-medium text-zinc-400">Void</span> means office withdrew the
        revision (locked records kept for audit). Line counts plus &ldquo;vs prior&rdquo; are high-level hints only —
        not a scope line diff.
      </p>

      <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/40">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/50 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              <th className="px-3 py-2">Revision</th>
              <th className="px-3 py-2">Status</th>
              <th className="hidden px-3 py-2 sm:table-cell">Lines</th>
              <th className="hidden px-3 py-2 lg:table-cell">vs prior (summary)</th>
              <th className="hidden px-3 py-2 md:table-cell">Context</th>
              <th className="px-3 py-2 text-center">Actions</th>
              <th className="px-3 py-2 text-right">Support</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/90">
            {versions.map((v, idx) => {
              const isHead = idx === 0;
              return (
                <tr key={v.id} className={`group text-zinc-300 hover:bg-zinc-900/30 transition-colors ${isHead ? "bg-zinc-900/20" : ""}`}>
                  <td className="whitespace-nowrap px-3 py-3 font-medium text-zinc-100">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        Version {v.versionNumber}
                        {isHead && (
                          <span className="rounded bg-sky-950/40 border border-sky-800/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-sky-400">
                            Head
                          </span>
                        )}
                      </div>
                      {v.status === "VOID" && v.voidReason ? (
                        <p className="max-w-[14rem] text-[10px] font-normal leading-snug text-rose-200/80">
                          {v.voidReason}
                        </p>
                      ) : null}
                      {v.status === "DECLINED" && v.portalDeclineReason ? (
                        <p className="max-w-[14rem] text-[10px] font-normal leading-snug text-orange-200/85">
                          Customer declined: {v.portalDeclineReason}
                        </p>
                      ) : null}
                      {v.status === "SENT" &&
                      v.portalChangeRequestedAt &&
                      (v.portalChangeRequestMessage?.trim().length ?? 0) > 0 ? (
                        <p className="max-w-[18rem] text-[10px] font-normal leading-snug text-amber-200/85">
                          Customer requested changes ({new Date(v.portalChangeRequestedAt).toLocaleString()}):{" "}
                          {v.portalChangeRequestMessage}
                        </p>
                      ) : null}
                      {v.status === "SUPERSEDED" ? (
                        <p className="max-w-[14rem] text-[10px] font-normal leading-snug text-zinc-500">
                          Replaced when a newer version was sent — not an active customer proposal.
                        </p>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <QuoteWorkspaceVersionStatusBadge status={v.status} />
                  </td>
                  <td className="hidden px-3 py-3 text-[11px] text-zinc-400 sm:table-cell">
                    {v.lineItemCount} line{v.lineItemCount === 1 ? "" : "s"}
                  </td>
                  <td className="hidden max-w-[20rem] px-3 py-3 text-[10px] leading-snug text-zinc-500 lg:table-cell">
                    {v.compareToPrior ? (
                      <span className="text-zinc-400">{quoteVersionCompareToPriorPlain(v.compareToPrior)}</span>
                    ) : (
                      <span className="text-zinc-600">Oldest revision — no prior row.</span>
                    )}
                  </td>
                  <td className="hidden max-w-[12rem] px-3 py-3 text-[11px] text-zinc-500 md:table-cell">
                    <div className="flex flex-wrap gap-1.5">
                      {v.hasPinnedWorkflow && (
                        <span className="rounded border border-zinc-800 bg-zinc-900 px-1 py-0.5 text-[10px] text-zinc-400">
                          Work plan
                        </span>
                      )}
                      {v.hasFrozenArtifacts && (
                        <span className="rounded border border-zinc-800 bg-zinc-900 px-1 py-0.5 text-[10px] text-zinc-400">
                          Locked proposal
                        </span>
                      )}
                      {v.hasActivation && (
                        <span className="rounded border border-emerald-900/20 bg-emerald-950/20 px-1 py-0.5 text-[10px] font-medium uppercase tracking-tight text-emerald-400/90">
                          Active
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center align-top">
                    <div className="flex flex-col items-center gap-2">
                      <Link
                        href={`/quotes/${quoteId}/versions/${v.id}/scope`}
                        className={`inline-block rounded px-2 py-1 text-xs font-medium transition-colors ${
                          isHead
                            ? "border border-sky-800/30 bg-sky-900/20 text-sky-400 hover:bg-sky-800/30"
                            : "border border-transparent bg-zinc-800/40 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                        }`}
                      >
                        View scope
                      </Link>
                      <QuoteVersionVoidControl
                        quoteVersionId={v.id}
                        status={v.status}
                        hasActivation={v.hasActivation}
                        versions={versions}
                        canOfficeMutate={canOfficeMutate}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right relative align-top">
                    <details className="inline-block text-left">
                      <summary className="cursor-pointer select-none text-[10px] text-zinc-600 hover:text-zinc-500 group-hover:text-zinc-400 transition-colors">
                        Advanced
                      </summary>
                      <ul className="absolute right-0 z-10 mt-1 min-w-[200px] space-y-1 rounded border border-zinc-800 bg-zinc-950/95 p-2 text-left font-mono text-[10px] text-zinc-500 shadow-xl shadow-black/40">
                        <li className="mb-1 break-all border-b border-zinc-800 pb-1 text-zinc-400">ID: {v.id}</li>
                        {v.compareToPrior ? (
                          <li className="border-b border-zinc-800 pb-2 text-[9px] leading-snug text-zinc-500">
                            {quoteVersionCompareToPriorTechnical(v.compareToPrior)}
                          </li>
                        ) : null}
                        <li>
                          <Link href={`/api/quote-versions/${v.id}/lifecycle`} className="text-sky-500/90 underline decoration-sky-900/40 hover:text-sky-400">
                            Lifecycle JSON
                          </Link>
                        </li>
                        <li>
                          <Link href={`/api/quote-versions/${v.id}/freeze`} className="text-sky-500/90 underline decoration-sky-900/40 hover:text-sky-400">
                            Freeze JSON
                          </Link>
                        </li>
                        <li className="text-zinc-600">Short id: {shortId(v.id)}</li>
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
