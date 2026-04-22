import Link from "next/link";
import { redirect } from "next/navigation";
import { getPrisma } from "@/server/db/prisma";
import {
  getGlobalWorkFeedReadModelForTenant,
  type GlobalWorkFeedPreJobTaskReadRow,
  type GlobalWorkFeedRuntimeTaskReadRow,
  type GlobalWorkFeedSkeletonTaskReadRow,
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

/** Quote workspace when a version link exists; otherwise project shell (same site). */
function preJobDeepLinkHref(row: GlobalWorkFeedPreJobTaskReadRow): string {
  if (row.quoteId != null) {
    return `/quotes/${encodeURIComponent(row.quoteId)}`;
  }
  return `/projects/${encodeURIComponent(row.flowGroupId)}`;
}

function preJobDeepLinkLabel(row: GlobalWorkFeedPreJobTaskReadRow): string {
  return row.quoteId != null ? "Quote workspace" : "Project";
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

  const skeletonByLane = {
    startable: model.skeletonRows.filter((r) => r.lane === "startable"),
    completable: model.skeletonRows.filter((r) => r.lane === "completable"),
    blocked: model.skeletonRows.filter((r) => r.lane === "blocked"),
  };

  function renderSkeletonTable(rows: GlobalWorkFeedSkeletonTaskReadRow[], showBlockers: boolean) {
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
            {rows.map((s) => (
              <tr key={`${s.flowId}:${s.skeletonTaskId}`} className="hover:bg-zinc-900/40">
                <td className="px-3 py-2">
                  <div className="font-medium text-zinc-100">{s.displayTitle}</div>
                  <div className="mt-0.5 font-mono text-[10px] text-zinc-600 break-all">
                    Skeleton id: {s.skeletonTaskId}
                  </div>
                  {showBlockers ? (
                    <div className="text-[10px] text-amber-200/80 mt-1">
                      {formatActionabilityBlockReasons(s.actionability)}
                    </div>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-xs text-zinc-400">
                  <div>{s.customerName}</div>
                  <div className="font-mono text-[11px] text-zinc-500">{s.quoteNumber}</div>
                </td>
                <td className="px-3 py-2 text-xs text-zinc-500 hidden md:table-cell">{s.flowGroupName}</td>
                <td className="px-3 py-2 font-mono text-[11px] text-zinc-500 hidden sm:table-cell">{s.nodeId}</td>
                <td className="px-3 py-2 text-right">
                  <Link
                    href={`/flows/${encodeURIComponent(s.flowId)}`}
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
                  <div className="font-medium text-zinc-100">{r.displayTitle}</div>
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

  function renderPreJobTable(rows: GlobalWorkFeedPreJobTaskReadRow[]) {
    if (rows.length === 0) {
      return (
        <p className="text-sm text-zinc-500 py-6 px-2 border border-dashed border-zinc-800 rounded-lg bg-zinc-950/40">
          No open pre-job tasks for this tenant.
        </p>
      );
    }
    return (
      <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950/40">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/50 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              <th className="px-3 py-2">Task</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 hidden md:table-cell">Type / source</th>
              <th className="px-3 py-2">Customer / quote</th>
              <th className="px-3 py-2 hidden lg:table-cell">Project</th>
              <th className="px-3 py-2 text-right">Open</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/90 text-zinc-300">
            {rows.map((p) => (
              <tr key={p.preJobTaskId} className="hover:bg-zinc-900/40">
                <td className="px-3 py-2">
                  <div className="font-medium text-zinc-100">{p.title}</div>
                  <div className="mt-1 text-[10px] text-zinc-600">
                    {p.assignedToLabel != null && <span>Assignee: {p.assignedToLabel} · </span>}
                    {p.dueAt != null && (
                      <span className="font-mono text-zinc-500">Due {p.dueAt.toISOString().slice(0, 10)} · </span>
                    )}
                    <span className="font-mono text-zinc-500">Created {p.createdAt.toISOString().slice(0, 10)}</span>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <span className="font-mono text-[10px] uppercase tracking-wide text-violet-300/90">{p.status}</span>
                </td>
                <td className="px-3 py-2 text-[11px] text-zinc-500 hidden md:table-cell">
                  <span className="font-mono text-zinc-400">{p.taskType}</span> ·{" "}
                  <span className="font-mono text-zinc-400">{p.sourceType}</span>
                </td>
                <td className="px-3 py-2 text-xs text-zinc-400">
                  <div>{p.customerName}</div>
                  {p.quoteNumber != null ? (
                    <div className="font-mono text-[11px] text-zinc-500">
                      {p.quoteNumber}
                      {p.quoteVersionNumber != null ? ` · v${String(p.quoteVersionNumber)}` : null}
                    </div>
                  ) : (
                    <div className="text-[10px] text-zinc-600 mt-0.5">Site-level (no quote link)</div>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-zinc-500 hidden lg:table-cell">{p.flowGroupName}</td>
                <td className="px-3 py-2 text-right">
                  <Link
                    href={preJobDeepLinkHref(p)}
                    className="inline-flex text-xs font-medium text-sky-400 hover:text-sky-300"
                  >
                    {preJobDeepLinkLabel(p)}
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
  const hasPreJob = model.preJobRows.length > 0;
  const hasSkeleton = model.skeletonRows.length > 0;

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-50">Work</h1>
        <p className="text-sm text-zinc-500 mt-1 max-w-3xl">
          Tenant-wide discovery: <span className="text-zinc-400">pre-job</span> site tasks (lifecycle only),{" "}
          <span className="text-zinc-400">workflow skeleton</span> tasks from the pinned snapshot (same eligibility as
          the flow API), and <span className="text-zinc-400">runtime</span> manifest tasks. Read-only — start, complete,
          and review stay on each flow&apos;s work feed.
        </p>
        {(model.runtimeTruncated ||
          model.preJobTruncated ||
          model.skeletonFlowScanTruncated ||
          model.skeletonRowsTruncated) && (
          <p className="mt-2 text-xs text-amber-400/90">
            {model.runtimeTruncated ? "Runtime list hit its fetch cap. " : null}
            {model.preJobTruncated ? "Pre-job list hit its fetch cap. " : null}
            {model.skeletonFlowScanTruncated ? "Skeleton scan stopped at max flows — more flows may exist. " : null}
            {model.skeletonRowsTruncated ? "Skeleton rows sliced after global cap. " : null}
            Narrow per project or flow as needed.
          </p>
        )}
      </div>

      <section className="mb-10" aria-labelledby="prejob-heading">
        <h2 id="prejob-heading" className="text-sm font-semibold text-violet-400 mb-2">
          Pre-job (site / flow group) — {model.preJobRows.length} open
        </h2>
        <p className="text-xs text-zinc-600 mb-3 max-w-3xl">
          Same `PreJobTask` rows as quote workspace: anchored to a project (flow group), optional quote version link.
          <span className="text-zinc-500"> Status is the record only — not payment/activation gates or scheduling.</span>
        </p>
        {renderPreJobTable(model.preJobRows)}
      </section>

      <section className="mb-10" aria-labelledby="skeleton-heading">
        <h2 id="skeleton-heading" className="text-sm font-semibold text-amber-400/90 mb-2">
          Workflow skeleton (pinned template) — {model.skeletonRows.length} open
        </h2>
        <p className="text-xs text-zinc-600 mb-3 max-w-3xl">
          Parsed from each flow&apos;s workflow snapshot + <span className="font-mono text-zinc-500">SKELETON</span>{" "}
          task executions. Lanes use <span className="text-zinc-500">evaluateSkeletonTaskActionability</span> (payment
          gates can target skeleton ids). Not a separate workflow editor — open the flow work feed to act.
        </p>
        <h3 className="text-xs font-semibold text-emerald-400/90 mb-2">Ready to start ({skeletonByLane.startable.length})</h3>
        <div className="mb-6">{renderSkeletonTable(skeletonByLane.startable, false)}</div>
        <h3 className="text-xs font-semibold text-sky-400/90 mb-2">Ready to complete ({skeletonByLane.completable.length})</h3>
        <div className="mb-6">{renderSkeletonTable(skeletonByLane.completable, false)}</div>
        <h3 className="text-xs font-semibold text-zinc-500 mb-2">Blocked or waiting ({skeletonByLane.blocked.length})</h3>
        <p className="text-xs text-zinc-600 mb-2">
          Blocker codes match <span className="text-zinc-500">evaluateSkeletonTaskActionability</span>.
        </p>
        {renderSkeletonTable(skeletonByLane.blocked, true)}
      </section>

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

      {!hasRuntime && !hasPreJob && !hasSkeleton ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 p-10 text-center text-zinc-500 text-sm">
          No open pre-job tasks, no skeleton rows, and no runtime tasks awaiting work (or all runtime/skeleton rows are
          already accepted).
        </div>
      ) : null}
    </div>
  );
}
