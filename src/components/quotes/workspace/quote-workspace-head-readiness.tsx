import Link from "next/link";
import {
  deriveQuoteHeadWorkspaceReadiness,
  type QuoteHeadReadinessInput,
  type ReadinessChecklistItem,
} from "@/lib/workspace/derive-quote-head-workspace-readiness";
import type { QuoteVersionHistoryItemDto } from "@/server/slice1/reads/quote-version-history-reads";

function toReadinessInput(row: QuoteVersionHistoryItemDto, lineItemCount: number): QuoteHeadReadinessInput {
  return {
    id: row.id,
    versionNumber: row.versionNumber,
    status: row.status,
    lineItemCount,
    hasPinnedWorkflow: row.hasPinnedWorkflow,
    hasFrozenArtifacts: row.hasFrozenArtifacts,
    hasActivation: row.hasActivation,
    proposalGroupCount: row.proposalGroupCount,
    sentAt: row.sentAt,
    signedAt: row.signedAt,
  };
}

type Props = {
  head: QuoteVersionHistoryItemDto | null;
  /** Count of line items on the head version (drives the "scope authored" check). */
  headLineItemCount?: number;
};

/**
 * Enhanced readiness / blockers summary for the quote workspace.
 */
export function QuoteWorkspaceHeadReadiness({ head, headLineItemCount = 0 }: Props) {
  const r = deriveQuoteHeadWorkspaceReadiness(head ? toReadinessInput(head, headLineItemCount) : null);

  if (r.kind === "no_versions") {
    return (
      <section className="mb-6 rounded-lg border border-dashed border-zinc-800 bg-zinc-950/30 p-6 text-sm">
        <h2 className="text-base font-semibold text-zinc-200">Quote readiness</h2>
        <p className="mt-2 text-zinc-500">No versions have been created for this quote yet.</p>
      </section>
    );
  }

  const vid = r.quoteVersionId;
  const satisfied = r.checklist.filter((c) => c.state === "yes");
  const missing = r.checklist.filter((c) => c.state === "no");
  const na = r.checklist.filter((c) => c.state === "n/a");

  return (
    <section className="mb-10 rounded-xl border border-zinc-800 bg-zinc-900/20 p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Workspace readiness</h2>
          <p className="text-xs text-zinc-500">
            Latest revision (v{r.versionNumber}) · <span className="text-zinc-400 font-medium uppercase tracking-wider">{r.status}</span>
          </p>
        </div>
        {r.recommendedStepIndex && (
          <div className="rounded-full bg-sky-500/10 px-3 py-1 border border-sky-500/20">
            <span className="text-[11px] font-bold uppercase tracking-widest text-sky-400">
              Next Step: {r.recommendedStepIndex}
            </span>
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-8 sm:grid-cols-2">
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-3">
            Checklist
          </h3>
          <div className="space-y-4">
            {missing.length > 0 && (
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-tight text-amber-500/80 mb-2">
                  Needs attention
                </h4>
                <ul className="space-y-1.5">
                  {missing.map((c) => (
                    <ReadinessItem key={c.id} item={c} />
                  ))}
                </ul>
              </div>
            )}
            
            {satisfied.length > 0 && (
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-tight text-emerald-500/80 mb-2">
                  Satisfied
                </h4>
                <ul className="space-y-1.5">
                  {satisfied.map((c) => (
                    <ReadinessItem key={c.id} item={c} />
                  ))}
                </ul>
              </div>
            )}

            {na.length > 0 && (
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-tight text-zinc-600 mb-2">
                  N/A for current status
                </h4>
                <ul className="space-y-1.5">
                  {na.map((c) => (
                    <ReadinessItem key={c.id} item={c} />
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-3">
            Recommended path
          </h3>
          <div className="rounded-lg bg-zinc-950/40 border border-zinc-800 p-4">
            <ol className="list-decimal list-outside ml-4 space-y-3">
              {r.likelyNextSteps.map((s, i) => (
                <li key={i} className="text-xs text-zinc-300 leading-relaxed pl-1">
                  {s}
                </li>
              ))}
            </ol>
            {r.recommendedStepIndex && (
              <div className="mt-4 pt-4 border-t border-zinc-800">
                <p className="text-[10px] text-zinc-500 italic">
                  Scroll down to Section {r.recommendedStepIndex} to proceed.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 pt-4 border-t border-zinc-800">
        <details className="text-[10px] text-zinc-600">
          <summary className="cursor-pointer font-medium hover:text-zinc-500">Technical details & honesty notes</summary>
          <div className="mt-4 space-y-3">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">Constraints</p>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-zinc-500">
                  {r.honestyNotes.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Record info</p>
                <div className="flex flex-wrap gap-x-4 gap-y-2 font-mono text-[11px]">
                  <span className="text-zinc-500">ID: {vid}</span>
                  <Link href={`/dev/quote-scope/${vid}`} className="text-sky-500/90 hover:text-sky-400">
                    Open scope
                  </Link>
                  <Link href={`/api/quote-versions/${vid}/lifecycle`} className="text-zinc-500 hover:text-zinc-400 underline decoration-zinc-800">
                    Lifecycle API
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </details>
      </div>
    </section>
  );
}

function ReadinessItem({ item }: { item: ReadinessChecklistItem }) {
  const isSatisfied = item.state === "yes";
  const isMissing = item.state === "no";
  
  return (
    <li className="flex gap-2.5">
      <div className="mt-0.5">
        {isSatisfied ? (
          <div className="h-4 w-4 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </div>
        ) : isMissing ? (
          <div className="h-4 w-4 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
            <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          </div>
        ) : (
          <div className="h-4 w-4 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700">
            <div className="h-1 w-1 rounded-full bg-zinc-600" />
          </div>
        )}
      </div>
      <div>
        <p className={`text-xs font-medium ${isSatisfied ? "text-zinc-300" : isMissing ? "text-zinc-100" : "text-zinc-500"}`}>
          {item.label}
        </p>
        {item.note && (
          <p className="text-[10px] text-zinc-500 leading-snug mt-0.5 max-w-sm">
            {item.note}
          </p>
        )}
      </div>
    </li>
  );
}
