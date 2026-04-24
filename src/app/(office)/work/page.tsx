import Link from "next/link";
import { redirect } from "next/navigation";
import { getPrisma } from "@/server/db/prisma";
import {
  getGlobalWorkFeedReadModelForTenant,
  type GlobalWorkFeedRuntimeTaskReadRow,
} from "@/server/slice1/reads/global-work-feed-reads";
import type { TaskActionability } from "@/server/slice1/eligibility/task-actionability";
import { tryGetApiPrincipal } from "@/lib/auth/api-principal";

export const dynamic = "force-dynamic";

function formatActionabilityBlockReasons(actionability: TaskActionability): string {
  const parts: string[] = [];
  if (!actionability.start.canStart) {
    parts.push(...actionability.start.reasons);
    for (const d of actionability.start.blockerDetails) {
      if (d.kind === "payment_gate") {
        parts.push(`Payment gate “${d.title}” (${d.gateId})`);
      } else {
        parts.push(`Hold ${d.scope} (${d.holdId}): ${d.reason}`);
      }
    }
  }
  if (!actionability.complete.canComplete) {
    parts.push(...actionability.complete.reasons);
  }
  const uniq = [...new Set(parts)];
  return uniq.length > 0 ? uniq.join(", ") : "—";
}

export default async function OfficeWorkFeedPage() {
  const auth = await tryGetApiPrincipal();
  if (!auth.ok) {
    redirect("/login");
  }

  const model = await getGlobalWorkFeedReadModelForTenant(getPrisma(), {
    tenantId: auth.principal.tenantId,
  });

  const byLane = {
    startable: model.rows.filter((r) => r.lane === "startable"),
    completable: model.rows.filter((r) => r.lane === "completable"),
    blocked: model.rows.filter((r) => r.lane === "blocked"),
  };

  function renderRuntimeTable(rows: GlobalWorkFeedRuntimeTaskReadRow[], showBlockers: boolean) {
    if (rows.length === 0) {
      return (
        <p className="text-sm text-zinc-500 py-6 px-2 border border-dashed border-zinc-800 rounded-lg bg-zinc-950/40">
          None in this section.
        </p>
      );
    }
    return (
      <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950/40">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/50 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              <th className="px-3 py-2">Task</th>
              <th className="px-3 py-2">Customer / quote</th>
              <th className="px-3 py-2 hidden md:table-cell">Project</th>
              <th className="px-3 py-2 hidden sm:table-cell">Node</th>
              <th className="px-3 py-2 text-right">Flow</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/90 text-zinc-300">
            {rows.map((r) => (
              <tr key={r.runtimeTaskId} className="hover:bg-zinc-900/40">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-zinc-100">{r.displayTitle}</span>
                    {r.isNextForJob ? (
                      <span
                        className="inline-flex items-center rounded-full border border-emerald-700/60 bg-emerald-900/30 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300"
                        title="First eligible task in frozen package slot order for this job"
                      >
                        Next
                      </span>
                    ) : null}
                  </div>
                  {showBlockers ? (
                    <div className="text-[10px] text-amber-200/80 mt-1">
                      {formatActionabilityBlockReasons(r.actionability)}
                    </div>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-xs text-zinc-400">
                  <div>{r.customerName}</div>
                  <div className="font-mono text-[11px] text-zinc-500">{r.quoteNumber}</div>
                </td>
                <td className="px-3 py-2 text-xs text-zinc-500 hidden md:table-cell">{r.flowGroupName}</td>
                <td className="px-3 py-2 font-mono text-[11px] text-zinc-500 hidden sm:table-cell">{r.nodeId}</td>
                <td className="px-3 py-2 text-right">
                  <Link
                    href={`/flows/${r.flowId}`}
                    className="inline-flex text-xs font-medium text-sky-400 hover:text-sky-300"
                  >
                    Work feed
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const hasRuntime = model.rows.length > 0;

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-50">Work</h1>
        <p className="text-sm text-zinc-500 mt-1 max-w-3xl">
          Tenant-wide execution work feed. Runtime manifest tasks only — restricted to each job&apos;s active flow with
          non-superseded RuntimeTasks; accepted rows are omitted. Read-only — start, complete, and review stay on each
          flow&apos;s work feed.
        </p>
        <p className="text-xs text-zinc-600 mt-2 max-w-3xl">
          One row per job is marked <span className="font-semibold text-emerald-400">Next</span>: the first eligible
          runtime task in frozen package slot order whose start or complete eligibility is true.
        </p>
        {model.runtimeTruncated && (
          <p className="mt-2 text-xs text-amber-400/90">
            Runtime list hit its fetch cap. Narrow per project or flow as needed.
          </p>
        )}
      </div>

      <section className="mb-10" aria-labelledby="startable-heading">
        <h2 id="startable-heading" className="text-sm font-semibold text-emerald-400 mb-3">
          Runtime — ready to start ({byLane.startable.length})
        </h2>
        {renderRuntimeTable(byLane.startable, false)}
      </section>

      <section className="mb-10" aria-labelledby="completable-heading">
        <h2 id="completable-heading" className="text-sm font-semibold text-sky-400 mb-3">
          Runtime — ready to complete ({byLane.completable.length})
        </h2>
        {renderRuntimeTable(byLane.completable, false)}
      </section>

      <section className="mb-10" aria-labelledby="blocked-heading">
        <h2 id="blocked-heading" className="text-sm font-semibold text-zinc-400 mb-3">
          Runtime — blocked or waiting ({byLane.blocked.length})
        </h2>
        <p className="text-xs text-zinc-600 mb-2">
          Blocker codes match `evaluateRuntimeTaskActionability` (e.g. payment gate, active operational hold, flow not
          activated, correction loop).
        </p>
        {renderRuntimeTable(byLane.blocked, true)}
      </section>

      {!hasRuntime ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 p-10 text-center text-zinc-500 text-sm">
          No runtime tasks awaiting work on any active flow (or all are already accepted).
        </div>
      ) : null}
    </div>
  );
}
