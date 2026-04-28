import Link from "next/link";

export type ExecutionBridgeData =
  | { kind: "none" }
  | {
      kind: "linked";
      quoteVersionId: string;
      versionNumber: number;
      quoteId: string;
      flowId: string | null;
      jobId: string | null;
      activationId: string | null;
      activatedAtIso: string | null;
      runtimeTaskCount: number | null;
    };

type Props = {
  data: ExecutionBridgeData;
};

/**
 * Links into job execution after start work; dev URLs stay under Advanced.
 */
export function QuoteWorkspaceExecutionBridge({ data }: Props) {
  if (data.kind === "none") {
    return (
      <section
        id="execution-bridge"
        className="mb-6 rounded border border-zinc-800 bg-zinc-950/20 p-4 text-sm"
      >
        <h2 className="mb-1 text-sm font-medium text-zinc-200">After approval</h2>
        <p className="text-xs text-zinc-500 leading-relaxed">
          When you start work on a signed version, the work feed and job shortcuts will appear here.
        </p>
      </section>
    );
  }

  const {
    quoteVersionId,
    versionNumber,
    flowId,
    jobId,
    activatedAtIso,
    runtimeTaskCount,
  } = data;

  return (
    <section id="execution-bridge" className="mb-6 rounded-lg border border-sky-900/30 bg-sky-950/10 p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between border-b border-sky-900/20 pb-3">
        <div>
          <h2 className="text-sm font-semibold text-sky-100">Job execution</h2>
          <p className="mt-1 text-[11px] text-sky-400/80">
            Work has been started for this quote. Open the work feed to track progress.
          </p>
        </div>
        <span className="rounded bg-sky-900/40 px-2 py-0.5 text-[10px] font-medium text-sky-300">
          v{versionNumber}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Open job</p>
            <div className="mt-2 flex flex-col gap-2">
              {flowId ? (
                <Link
                  href={`/flows/${encodeURIComponent(flowId)}`}
                  className="flex items-center justify-between rounded bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-white transition-colors"
                >
                  <span>Go to Work Feed</span>
                  <span className="text-[10px] opacity-60">→</span>
                </Link>
              ) : (
                <p className="text-xs text-zinc-500 italic">Work feed not linked yet</p>
              )}
            </div>
          </div>

          <details className="rounded border border-zinc-800/80 bg-zinc-950/40">
            <summary className="cursor-pointer px-3 py-2 text-[10px] font-medium text-zinc-500 hover:text-zinc-400">
              Advanced (development)
            </summary>
            <div className="space-y-3 border-t border-zinc-800/60 px-3 pb-3 pt-2">
              <div className="mt-1 flex flex-col gap-2">
                {flowId ? (
                  <>
                    <Link
                      href={`/dev/work-feed/${encodeURIComponent(flowId)}`}
                      className="flex items-center justify-between rounded border border-sky-800/40 bg-sky-900/20 px-3 py-2 text-xs font-medium text-sky-300 hover:bg-sky-900/40 transition-colors"
                    >
                      <span>[Dev] Work feed</span>
                      <span className="text-[10px] opacity-60">→</span>
                    </Link>
                    <Link
                      href={`/dev/flow/${encodeURIComponent(flowId)}`}
                      className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
                    >
                      <span>[Dev] Flow detail</span>
                      <span className="text-[10px] opacity-60">→</span>
                    </Link>
                  </>
                ) : (
                  <p className="text-xs text-zinc-500 italic">Flow record not linked</p>
                )}
                {jobId ? (
                  <Link
                    href={`/dev/jobs/${encodeURIComponent(jobId)}`}
                    className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
                  >
                    <span>Job detail</span>
                    <span className="text-[10px] opacity-60">→</span>
                  </Link>
                ) : null}
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Discovery</p>
                <div className="mt-2 flex gap-3 text-[11px]">
                  <Link href="/dev/flows" className="text-sky-400 hover:underline">
                    All activated flows
                  </Link>
                  <Link href="/dev/jobs" className="text-sky-400 hover:underline">
                    All jobs
                  </Link>
                </div>
              </div>
            </div>
          </details>
        </div>

        <div className="rounded border border-zinc-800/60 bg-zinc-900/40 p-3 text-[11px] text-zinc-400">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Job summary</p>
          <dl className="space-y-2">
            <div className="flex justify-between">
              <dt className="text-zinc-500">Started</dt>
              <dd className="text-zinc-300">
                {activatedAtIso ? (
                  activatedAtIso
                ) : (
                  <span className="font-medium text-amber-700/90">missing date</span>
                )}
              </dd>
            </div>
            {runtimeTaskCount != null && (
              <div className="flex justify-between">
                <dt className="text-zinc-500">Job tasks</dt>
                <dd className="text-zinc-300">{runtimeTaskCount}</dd>
              </div>
            )}
            <div className="border-t border-zinc-800/60 pt-2 flex flex-col gap-1">
              <dt className="text-[9px] uppercase text-zinc-600">Context identifiers</dt>
              <dd className="font-mono text-[10px] text-zinc-500 truncate">
                Flow: {flowId ?? "none"}
              </dd>
              <dd className="font-mono text-[10px] text-zinc-500 truncate">
                Job: {jobId ?? "none"}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="mt-4 border-t border-zinc-800/40 pt-3">
        <details className="text-[10px] text-zinc-600">
          <summary className="cursor-pointer font-medium hover:text-zinc-500">
            Advanced (support)
          </summary>
          <div className="mt-2 space-y-2">
            <p>
              Target: v{versionNumber} · <span className="font-mono">{quoteVersionId}</span>
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1 underline">
              <Link
                href={`/api/quote-versions/${encodeURIComponent(quoteVersionId)}/lifecycle`}
                className="hover:text-zinc-500"
              >
                Lifecycle JSON
              </Link>
              {flowId ? (
                <Link
                  href={`/api/flows/${encodeURIComponent(flowId)}`}
                  className="hover:text-zinc-500"
                >
                  Flow execution JSON
                </Link>
              ) : null}
              {jobId ? (
                <Link
                  href={`/api/jobs/${encodeURIComponent(jobId)}`}
                  className="hover:text-zinc-500"
                >
                  Job shell JSON
                </Link>
              ) : null}
              <Link
                href={`/dev/quote-scope/${encodeURIComponent(quoteVersionId)}`}
                className="hover:text-zinc-500"
              >
                Scope (read-only)
              </Link>
            </div>
          </div>
        </details>
      </div>
    </section>
  );
}
