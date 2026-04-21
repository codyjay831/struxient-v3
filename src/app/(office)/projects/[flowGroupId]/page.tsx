import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { getPrisma } from "@/server/db/prisma";
import { getFlowGroupForTenant } from "@/server/slice1/reads/flow-group-reads";
import { listCommercialQuoteShellsForTenant } from "@/server/slice1/reads/commercial-quote-shell-reads";

/**
 * Office project detail. Read-only inspector for a single FlowGroup record.
 *
 * Reuses two canon read models, both tenant-scoped:
 *   - `getFlowGroupForTenant` — identity, customer linkage, rollup counts,
 *     activated Job id (if any)
 *   - `listCommercialQuoteShellsForTenant({ ..., flowGroupId })` — quotes
 *     authored under this project (uses the read's newly-added optional
 *     `flowGroupId` filter; tenant scoping is preserved by the leading
 *     `tenantId` predicate)
 *
 * The Evidence rollup already lives at `/projects/[flowGroupId]/evidence`;
 * this detail page surfaces it as a primary navigation entry.
 */
export const dynamic = "force-dynamic";

const SUB_LIST_LIMIT = 50;

type PageProps = { params: Promise<{ flowGroupId: string }> };

const QUOTE_VERSION_STATUS_BADGE: Record<string, string> = {
  DRAFT: "border-amber-800/60 bg-amber-950/30 text-amber-300",
  SENT: "border-sky-800/60 bg-sky-950/30 text-sky-300",
  SIGNED: "border-emerald-800/60 bg-emerald-950/30 text-emerald-300",
};

function formatCreatedDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

export default async function OfficeProjectDetailPage({ params }: PageProps) {
  const { flowGroupId } = await params;
  const auth = await tryGetApiPrincipal();
  if (!auth.ok) {
    redirect("/login");
  }

  const prisma = getPrisma();
  const tenantId = auth.principal.tenantId;

  const project = await getFlowGroupForTenant(prisma, { tenantId, flowGroupId });
  if (!project) {
    notFound();
  }

  const quotes = await listCommercialQuoteShellsForTenant(prisma, {
    tenantId,
    flowGroupId,
    limit: SUB_LIST_LIMIT,
  });
  const quotesTruncated = project.quoteCount > quotes.length;

  return (
    <main className="mx-auto max-w-5xl p-8 text-zinc-200">
      <nav className="mb-4 text-xs text-zinc-500">
        <Link href="/projects" className="hover:text-zinc-300">
          Projects
        </Link>
        <span className="mx-2 text-zinc-700">/</span>
        <span className="text-zinc-400">{project.name}</span>
      </nav>

      <header className="mb-8 border-b border-zinc-800 pb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex flex-wrap items-baseline gap-2 text-2xl font-semibold tracking-tight text-zinc-50">
              <span>{project.name}</span>
              {project.jobId ? (
                <span className="rounded border border-emerald-800/60 bg-emerald-950/30 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                  Activated
                </span>
              ) : (
                <span className="rounded border border-zinc-700 bg-zinc-950/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                  Not activated
                </span>
              )}
              <span className="rounded border border-zinc-700 bg-zinc-950/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                Read-only
              </span>
            </h1>
            <p className="mt-2 text-xs text-zinc-500">
              Customer:{" "}
              <Link
                href={`/customers/${project.customer.id}`}
                className="text-zinc-300 hover:text-sky-400"
              >
                {project.customer.name}
              </Link>
              {" · "}
              Created {formatCreatedDate(project.createdAt)}
            </p>
          </div>
          <Link href="/projects" className="text-sm text-zinc-500 hover:text-zinc-400">
            ← All projects
          </Link>
        </div>
      </header>

      <section className="mb-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Activation
          </div>
          {project.jobId ? (
            <>
              <div className="mt-2 text-sm font-medium text-emerald-300">Job activated</div>
              <p className="mt-1 text-xs text-zinc-500">
                A stable Job record was created when this project was signed and activated.
              </p>
              <Link
                href={`/jobs/${project.jobId}`}
                className="mt-4 inline-flex items-center text-xs font-medium text-sky-400 hover:text-sky-300"
              >
                Open job →
              </Link>
            </>
          ) : (
            <>
              <div className="mt-2 text-sm font-medium text-zinc-400">Not yet activated</div>
              <p className="mt-1 text-xs text-zinc-500">
                A Job is created automatically when a quote version under this project is signed
                and activated.
              </p>
            </>
          )}
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Evidence
          </div>
          <div className="mt-2 text-sm font-medium text-zinc-200">
            Project evidence roll-up
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            All collected evidence across this project's flows, organized for share-out.
          </p>
          <Link
            href={`/projects/${project.id}/evidence`}
            className="mt-4 inline-flex items-center text-xs font-medium text-sky-400 hover:text-sky-300"
          >
            Open evidence →
          </Link>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Quotes</h2>
          {quotesTruncated ? (
            <span className="text-[11px] text-zinc-500 italic">
              Showing {quotes.length} of {project.quoteCount}
            </span>
          ) : null}
        </div>
        {quotes.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950/30 p-6 text-sm text-zinc-500">
            No quotes yet for this project.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/20">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/40 text-[11px] uppercase font-bold tracking-wider text-zinc-500">
                  <th className="px-5 py-3">Quote #</th>
                  <th className="px-5 py-3">Latest version</th>
                  <th className="px-5 py-3 text-right">Proposal groups</th>
                  <th className="px-5 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {quotes.map((q) => (
                  <tr key={q.quote.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-5 py-4">
                      <Link
                        href={`/quotes/${q.quote.id}`}
                        className="font-mono text-sm text-zinc-100 hover:text-sky-400 transition-colors"
                      >
                        {q.quote.quoteNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-4">
                      {q.latestQuoteVersion ? (
                        <span className="inline-flex flex-wrap items-baseline gap-2">
                          <span className="text-sm text-zinc-200">
                            v{q.latestQuoteVersion.versionNumber}
                          </span>
                          <span
                            className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                              QUOTE_VERSION_STATUS_BADGE[q.latestQuoteVersion.status] ??
                              "border-zinc-700 text-zinc-400"
                            }`}
                          >
                            {q.latestQuoteVersion.status}
                          </span>
                          {q.latestQuoteVersion.hasActivation ? (
                            <span className="text-[10px] uppercase tracking-wide text-emerald-400">
                              activated
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="text-[11px] text-zinc-500 italic">no version</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="text-sm font-mono text-zinc-300">
                        {q.latestQuoteVersion?.proposalGroupCount ?? 0}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-zinc-400">
                      {formatCreatedDate(q.quote.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
