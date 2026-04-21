import Link from "next/link";
import { redirect } from "next/navigation";
import { tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { getPrisma } from "@/server/db/prisma";
import { listJobsForTenant } from "@/server/slice1/reads/job-discovery-reads";

/**
 * Office-surface discovery for Jobs.
 *
 * Reuses `listJobsForTenant` — the same tenant-scoped read model the
 * `/dev/jobs` page consumes — so this surface never invents new job
 * semantics. Jobs are created at SIGN and serve as the post-commercial
 * anchor for one or more activated execution Flows; listing Job rows is
 * the canonical way to enumerate post-sign engagements for a tenant.
 *
 * Read-only on purpose: per-job inspection lives at `/jobs/[jobId]`; this
 * page is the discovery / index surface only.
 */
export const dynamic = "force-dynamic";

const LIST_LIMIT = 80;

function formatJobOpenedDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function OfficeJobsListPage() {
  const auth = await tryGetApiPrincipal();

  if (!auth.ok) {
    redirect("/login");
  }

  const items = await listJobsForTenant(getPrisma(), {
    tenantId: auth.principal.tenantId,
    limit: LIST_LIMIT,
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-50">Jobs</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Post-sign anchors for execution. A job is created when a quote version is signed and links a
            customer engagement to one or more activated flows.
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-zinc-500"
            >
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
          </div>
          <h2 className="text-zinc-200 font-medium">No jobs yet</h2>
          <p className="text-zinc-500 text-sm mt-1 mb-6 max-w-sm mx-auto">
            Jobs appear here after a quote version is signed. Open a sent quote and record the customer
            signature to create one.
          </p>
          <Link
            href="/quotes"
            className="inline-flex items-center px-4 py-2 bg-sky-700 hover:bg-sky-600 text-white rounded-md text-sm font-medium transition-colors"
          >
            Open Quotes
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/20">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/40 text-[11px] uppercase font-bold tracking-wider text-zinc-500">
                <th className="px-6 py-4">Customer &amp; Project</th>
                <th className="px-6 py-4">Latest Quote</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Flows</th>
                <th className="px-6 py-4">Opened</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {items.map((item) => {
                const isActivated = item.flowCount > 0;
                const statusLabel = isActivated ? "Activated" : "Signed";
                const statusStyle = isActivated
                  ? "text-emerald-400 bg-emerald-950/30 border-emerald-800/50"
                  : "text-sky-400 bg-sky-950/30 border-sky-800/50";

                return (
                  <tr key={item.job.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-6 py-5">
                      <Link
                        href={`/jobs/${item.job.id}`}
                        className="font-semibold text-zinc-50 hover:text-sky-400 transition-colors"
                      >
                        {item.customer.name}
                      </Link>
                      <div className="text-xs text-zinc-500 mt-0.5">{item.flowGroup.name}</div>
                    </td>
                    <td className="px-6 py-5">
                      {item.latestFlow ? (
                        <span className="text-sm font-mono text-zinc-300">
                          {item.latestFlow.quoteNumber}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-500 italic">—</span>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${statusStyle}`}
                      >
                        {statusLabel}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <span className="text-sm font-mono text-zinc-300">{item.flowCount}</span>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-xs text-zinc-400">
                        {formatJobOpenedDate(item.job.createdAt)}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <Link
                        href={`/jobs/${item.job.id}`}
                        className="inline-flex items-center px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-zinc-50 rounded text-xs font-medium transition-all"
                      >
                        Open Job
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
