import Link from "next/link";
import { redirect } from "next/navigation";
import { tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { getPrisma } from "@/server/db/prisma";
import { listFlowGroupsForTenant } from "@/server/slice1/reads/flow-group-reads";

/**
 * Office projects index. Read-only.
 *
 * "Project" is the canonical office name for `FlowGroup` (matches the existing
 * `(office)/projects/[flowGroupId]/evidence` route). Each project anchors a
 * customer engagement and serves as the container for quote versions and the
 * stable Job record after activation.
 *
 * Reuses `listFlowGroupsForTenant`.
 */
export const dynamic = "force-dynamic";

const LIST_LIMIT = 200;

function formatCreatedDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

export default async function OfficeProjectsListPage() {
  const auth = await tryGetApiPrincipal();
  if (!auth.ok) {
    redirect("/login");
  }

  const items = await listFlowGroupsForTenant(getPrisma(), {
    tenantId: auth.principal.tenantId,
    limit: LIST_LIMIT,
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-50">Projects</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Tenant-scoped project records. Each project anchors a customer engagement and
            contains one or more quote versions; once activated, it carries the stable Job.
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
              <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z" />
            </svg>
          </div>
          <h2 className="text-zinc-200 font-medium">No projects yet</h2>
          <p className="text-zinc-500 text-sm mt-1 max-w-sm mx-auto">
            Projects appear here once a quote shell is created. Start a new quote to add your
            first project.
          </p>
          <Link
            href="/quotes/new"
            className="inline-block mt-4 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-md text-sm font-medium transition-colors"
          >
            New quote
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/20">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/40 text-[11px] uppercase font-bold tracking-wider text-zinc-500">
                <th className="px-6 py-4">Project</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4 text-right">Quotes</th>
                <th className="px-6 py-4">Job</th>
                <th className="px-6 py-4">Created</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {items.map((project) => (
                <tr key={project.id} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="px-6 py-5">
                    <Link
                      href={`/projects/${project.id}`}
                      className="font-semibold text-zinc-50 hover:text-sky-400 transition-colors"
                    >
                      {project.name}
                    </Link>
                  </td>
                  <td className="px-6 py-5">
                    <Link
                      href={`/customers/${project.customer.id}`}
                      className="text-sm text-zinc-300 hover:text-sky-400 transition-colors"
                    >
                      {project.customer.name}
                    </Link>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <span className="text-sm font-mono text-zinc-300">{project.quoteCount}</span>
                  </td>
                  <td className="px-6 py-5">
                    {project.jobId ? (
                      <Link
                        href={`/jobs/${project.jobId}`}
                        className="inline-flex items-center rounded border border-emerald-800/60 bg-emerald-950/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300 hover:text-emerald-200"
                      >
                        Activated
                      </Link>
                    ) : (
                      <span className="text-[11px] text-zinc-500 italic">none</span>
                    )}
                  </td>
                  <td className="px-6 py-5">
                    <span className="text-xs text-zinc-400">
                      {formatCreatedDate(project.createdAt)}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <Link
                      href={`/projects/${project.id}`}
                      className="inline-flex items-center px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-zinc-50 rounded text-xs font-medium transition-all"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
