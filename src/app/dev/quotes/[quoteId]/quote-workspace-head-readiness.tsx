import Link from "next/link";
import {
  deriveQuoteHeadWorkspaceReadiness,
  type QuoteHeadReadinessInput,
} from "@/lib/workspace/derive-quote-head-workspace-readiness";
import type { QuoteVersionHistoryItemDto } from "@/server/slice1/reads/quote-version-history-reads";

function toReadinessInput(row: QuoteVersionHistoryItemDto): QuoteHeadReadinessInput {
  return {
    id: row.id,
    versionNumber: row.versionNumber,
    status: row.status,
    hasPinnedWorkflow: row.hasPinnedWorkflow,
    hasFrozenArtifacts: row.hasFrozenArtifacts,
    hasActivation: row.hasActivation,
    proposalGroupCount: row.proposalGroupCount,
    sentAt: row.sentAt,
    signedAt: row.signedAt,
  };
}

function stateClass(state: "yes" | "no" | "n/a"): string {
  if (state === "yes") return "text-emerald-600/90";
  if (state === "no") return "text-amber-600/90";
  return "text-zinc-500";
}

type Props = {
  head: QuoteVersionHistoryItemDto | null;
};

/**
 * Read-only head summary for dev workspace: derived from workspace version row + honest compose caveats.
 */
export function QuoteWorkspaceHeadReadiness({ head }: Props) {
  const r = deriveQuoteHeadWorkspaceReadiness(head ? toReadinessInput(head) : null);

  if (r.kind === "no_versions") {
    return (
      <section className="mb-6 rounded border border-zinc-800 bg-zinc-950/50 p-4 text-sm">
        <h2 className="mb-1 text-sm font-medium text-zinc-200">Head version — readiness</h2>
        <p className="text-xs text-zinc-500">No versions on this quote yet.</p>
      </section>
    );
  }

  const vid = r.quoteVersionId;

  return (
    <section className="mb-6 rounded border border-zinc-800 bg-zinc-950/50 p-4 text-sm">
      <h2 className="mb-1 text-sm font-medium text-zinc-200">Current status</h2>
      <p className="text-xs text-zinc-500">
        Latest revision (v{r.versionNumber}) ·{" "}
        <span className="text-zinc-400">{r.status}</span>
      </p>

      <ul className="mt-3 space-y-2 text-xs">
        {r.checklist.map((c) => (
          <li key={c.id} className="rounded border border-zinc-800/80 bg-zinc-900/40 px-2 py-1.5">
            <span className="text-zinc-400">{c.label}:</span>{" "}
            <span className={stateClass(c.state)}>{c.state}</span>
            {c.note ? <p className="mt-0.5 text-[11px] leading-snug text-zinc-500">{c.note}</p> : null}
          </li>
        ))}
      </ul>

      <div className="mt-4">
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Recommended action</p>
        <ol className="mt-1 list-inside list-decimal space-y-1 text-xs text-zinc-400">
          {r.likelyNextSteps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <details className="text-[10px] text-zinc-600">
          <summary className="cursor-pointer font-medium hover:text-zinc-500">Technical details</summary>
          <div className="mt-2 space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Summary constraints</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5 text-[11px] text-zinc-500">
              {r.honestyNotes.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1 font-mono">
              <span className="text-zinc-500">ID: {vid}</span>
              <Link href={`/dev/quote-scope/${vid}`} className="text-sky-500/90 hover:text-sky-400">
                Open scope (dev)
              </Link>
              <Link href={`/api/quote-versions/${vid}/lifecycle`} className="text-zinc-500 hover:text-zinc-400 underline">
                Lifecycle JSON
              </Link>
              <Link href={`/api/quote-versions/${vid}/freeze`} className="text-zinc-500 hover:text-zinc-400 underline">
                Freeze JSON
              </Link>
            </div>
          </div>
        </details>
      </div>
    </section>
  );
}
