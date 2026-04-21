import Link from "next/link";
import { InternalBreadcrumb } from "@/components/internal/internal-breadcrumb";
import { getPrisma } from "@/server/db/prisma";
import { listJobsForTenant } from "@/server/slice1/reads/job-discovery-reads";
import { tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { InternalEmptyDiscoveryState } from "@/components/internal/internal-state-feedback";
import { InternalQuickJump } from "@/components/internal/internal-quick-jump";

export const dynamic = "force-dynamic";

const LIST_LIMIT = 80;

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().replace("T", " ").replace(/\..+$/, " UTC");
}

/**
 * Tenant-scoped discovery for Job records.
 * Jobs are created at SIGN and serve as the stable anchor for execution.
 */
export default async function DevJobsListPage() {
  const auth = await tryGetApiPrincipal();

  if (!auth.ok) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <p className="text-zinc-300">
          Sign in at <Link href="/dev/login" className="text-sky-400">/dev/login</Link> or enable dev auth
          bypass (see .env.example).
        </p>
        <Link href="/" className="mt-4 inline-block text-sm text-sky-400">
          ← Testing hub
        </Link>
      </main>
    );
  }

  const items = await listJobsForTenant(getPrisma(), {
    tenantId: auth.principal.tenantId,
    limit: LIST_LIMIT,
  });

  const discoveryLinks = [
    { label: "Activated flows", href: "/dev/flows" },
    { label: "Jobs", href: "/dev/jobs", isActive: true },
  ];

  return (
    <main className="mx-auto max-w-3xl p-8 text-zinc-200">
      <header className="mb-6 border-b border-zinc-800 pb-5">
        <div className="flex flex-wrap items-start justify-between gap-3 text-sky-400">
          <div>
            <InternalBreadcrumb
              category="Execution"
              segments={[{ label: "Jobs" }]}
            />
            <h1 className="mt-2 text-xl font-semibold tracking-tight text-zinc-50">Jobs</h1>
            <p className="mt-2 max-w-xl text-xs leading-relaxed text-zinc-500">
              Tenant-scoped list of job records. Jobs are idempotently ensured when a quote version is
              signed. They link the commercial flow group to one or more activated execution records.
            </p>
          </div>
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-400">
            ← Hub
          </Link>
        </div>
      </header>

      <div className="mb-8">
        <InternalQuickJump title="Discovery" links={discoveryLinks} />
      </div>

      {items.length === 0 ? (
        <InternalEmptyDiscoveryState
          resourceName="Jobs"
          createInstructions="Jobs are created when you record a customer signature on a sent quote. They link commercial flow groups to execution records."
          action={{ href: "/dev/quotes", label: "Open quote list" }}
        />
      ) : (
        <ul className="space-y-3 text-sm">
          {items.map((item) => (
            <li
              key={item.job.id}
              className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-base font-semibold text-zinc-50">
                    Job {item.job.id.slice(0, 12)}…
                  </span>
                  <span className="text-xs text-zinc-500">
                    created {formatTimestamp(item.job.createdAt)}
                  </span>
                </div>
                <span className="inline-flex items-center rounded border border-emerald-800/80 bg-emerald-950/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                  {item.flowCount > 0 ? "Activated" : "Signed"}
                </span>
              </div>

              <div className="mt-1 text-xs text-zinc-400">
                {item.customer.name} · {item.flowGroup.name}
              </div>

              {item.latestFlow ? (
                <div className="mt-3 rounded border border-zinc-800/60 bg-zinc-950/30 p-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-tight text-zinc-600">
                    Latest flow
                  </p>
                  <div className="mt-1 flex items-center justify-between gap-3 text-[11px]">
                    <p className="text-zinc-300 font-medium">
                      {item.latestFlow.quoteNumber} (v{item.flowCount} total)
                    </p>
                    <Link
                      href={`/dev/work-feed/${item.latestFlow.id}`}
                      className="text-sky-400 hover:text-sky-300"
                    >
                      Open work feed →
                    </Link>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-[11px] text-zinc-500 italic">
                  No execution flows created for this job yet.
                </p>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/dev/jobs/${item.job.id}`}
                  className="rounded bg-sky-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-600"
                >
                  Job detail
                </Link>
                {item.latestFlow ? (
                  <Link
                    href={`/dev/flow/${item.latestFlow.id}`}
                    className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800"
                  >
                    Flow detail
                  </Link>
                ) : null}
                <Link
                  href={`/dev/flow-groups`}
                  className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
                >
                  Flow group
                </Link>
              </div>

              <details className="mt-3">
                <summary className="cursor-pointer text-[10px] text-zinc-500 hover:text-zinc-300">
                  Technical details
                </summary>
                <dl className="mt-2 space-y-1 text-[11px] text-zinc-500">
                  <div>
                    Job ID: <code className="text-zinc-400">{item.job.id}</code>
                  </div>
                  <div>
                    Flow group ID: <code className="text-zinc-400">{item.job.flowGroupId}</code>
                  </div>
                  <div>
                    <Link
                      href={`/api/jobs/${item.job.id}`}
                      className="text-sky-400 hover:text-sky-300"
                    >
                      GET /api/jobs/{item.job.id.slice(0, 10)}… (JSON)
                    </Link>
                  </div>
                </dl>
              </details>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8 flex flex-wrap gap-3 text-sm">
        <Link href="/dev/flows" className="text-sky-400 hover:text-sky-300">
          Activated flows
        </Link>
        <Link href="/dev/quotes" className="text-sky-400 hover:text-sky-300">
          Quote list
        </Link>
        <Link href="/" className="text-zinc-500 hover:text-zinc-400">
          ← Hub
        </Link>
      </div>
    </main>
  );
}
