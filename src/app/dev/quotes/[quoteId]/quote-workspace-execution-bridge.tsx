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
 * Thin bridge into existing execution reads + dev surfaces. No task controls — links only.
 */
export function QuoteWorkspaceExecutionBridge({ data }: Props) {
  if (data.kind === "none") {
    return (
      <section className="mb-6 rounded border border-zinc-800 bg-zinc-950/20 p-4 text-sm">
        <h2 className="mb-1 text-sm font-medium text-zinc-200">Execution bridge</h2>
        <p className="text-xs text-zinc-500 italic">
          No version in history has been activated yet. Once a signed version is activated, links to the runtime execution will appear here.
        </p>
      </section>
    );
  }

  const { quoteVersionId, versionNumber, quoteId, flowId, jobId, activationId, activatedAtIso, runtimeTaskCount } =
    data;

  return (
    <section className="mb-6 rounded border border-zinc-800 bg-zinc-950/20 p-4 text-sm">
      <h2 className="mb-1 text-sm font-medium text-zinc-200">Execution bridge</h2>
      <p className="text-xs text-zinc-500">
        Active execution for v{versionNumber}.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded border border-zinc-800/60 bg-zinc-900/40 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Links</p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-2 text-xs">
            {flowId ?
              <>
                <Link href={`/dev/flow/${encodeURIComponent(flowId)}`} className="text-sky-400 font-medium hover:text-sky-300">
                  Open flow
                </Link>
                <Link href={`/dev/work-feed/${encodeURIComponent(flowId)}`} className="text-sky-400 font-medium hover:text-sky-300">
                  Work feed
                </Link>
              </>
            : <span className="text-zinc-500 italic">Flow not found</span>}
          </div>
        </div>

        <div className="rounded border border-zinc-800/60 bg-zinc-900/40 p-3 text-xs text-zinc-400">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Summary</p>
          <ul className="mt-2 space-y-1">
            <li>
              <span className="text-zinc-500">Activated:</span>{" "}
              {activatedAtIso ? activatedAtIso : <span className="text-amber-700/90 font-medium">missing date</span>}
            </li>
            {runtimeTaskCount != null ?
              <li>
                <span className="text-zinc-500">Runtime tasks:</span> {String(runtimeTaskCount)}
              </li>
            : null}
          </ul>
        </div>
      </div>

      <div className="mt-4 border-t border-zinc-800/40 pt-3">
        <details className="text-[10px] text-zinc-600">
          <summary className="cursor-pointer font-medium hover:text-zinc-500">Technical details</summary>
          <div className="mt-2 space-y-2">
            <p>Target: v{versionNumber} · <span className="font-mono">{quoteVersionId}</span></p>
            <ul className="flex flex-col gap-1 font-mono text-[11px]">
              <li>Activation ID: {activationId ?? "none"}</li>
              <li>Flow ID: {flowId ?? "none"}</li>
              <li>Job ID: {jobId ?? "none"}</li>
            </ul>
            <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1 underline">
              <Link
                href={`/api/quote-versions/${encodeURIComponent(quoteVersionId)}/lifecycle`}
                className="hover:text-zinc-500"
              >
                Lifecycle JSON
              </Link>
              {flowId ?
                <Link href={`/api/flows/${encodeURIComponent(flowId)}`} className="hover:text-zinc-500">
                  Flow execution JSON
                </Link>
              : null}
              {jobId ?
                <Link href={`/api/jobs/${encodeURIComponent(jobId)}`} className="hover:text-zinc-500">
                  Job shell JSON
                </Link>
              : null}
              <Link href={`/dev/quote-scope/${encodeURIComponent(quoteVersionId)}`} className="hover:text-zinc-500">
                Scope (dev)
              </Link>
              <Link href={`/api/quotes/${encodeURIComponent(quoteId)}/workspace`} className="hover:text-zinc-500">
                Workspace JSON
              </Link>
            </div>
          </div>
        </details>
      </div>
    </section>
  );
}
