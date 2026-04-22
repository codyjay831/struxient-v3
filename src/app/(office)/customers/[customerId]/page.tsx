import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { principalHasCapability, tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { getPrisma } from "@/server/db/prisma";
import { getCustomerForTenant } from "@/server/slice1/reads/customer-reads";
import { listCustomerContactsForTenant } from "@/server/slice1/reads/customer-contact-reads";
import { listCustomerNotesForTenant } from "@/server/slice1/reads/customer-note-reads";
import { listCustomerRecentActivityForTenant } from "@/server/slice1/reads/customer-recent-activity-reads";
import { listFlowGroupsForTenant } from "@/server/slice1/reads/flow-group-reads";
import { listCommercialQuoteShellsForTenant } from "@/server/slice1/reads/commercial-quote-shell-reads";
import { CustomerContactsPanel } from "@/components/customers/customer-contacts-panel";
import { CustomerNotesPanel } from "@/components/customers/customer-notes-panel";
import { CustomerRecentActivityPanel } from "@/components/customers/customer-recent-activity-panel";

/**
 * Office customer detail. Read-only inspector for a single Customer record.
 *
 * Reuses canon read models, all tenant-scoped:
 *   - `getCustomerForTenant` — identity + rollup counts
 *   - `listFlowGroupsForTenant({ ..., customerId })` — projects of this customer
 *   - `listCommercialQuoteShellsForTenant({ ..., customerId })` — quotes of this customer
 *   - `listCustomerRecentActivityForTenant` — merged **summary** of note + contact row timestamps (not audit / not quotes)
 *
 * The two list reads use their newly-added optional `customerId` filter
 * (additive on top of the existing `tenantId` predicate) so this page can
 * surface real per-customer relationship rows without any client-side filtering
 * over a tenant-wide capped list.
 */
export const dynamic = "force-dynamic";

const SUB_LIST_LIMIT = 50;

type PageProps = { params: Promise<{ customerId: string }> };

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

export default async function OfficeCustomerDetailPage({ params }: PageProps) {
  const { customerId } = await params;
  const auth = await tryGetApiPrincipal();
  if (!auth.ok) {
    redirect("/login");
  }

  const prisma = getPrisma();
  const tenantId = auth.principal.tenantId;

  const customer = await getCustomerForTenant(prisma, { tenantId, customerId });
  if (!customer) {
    notFound();
  }

  const [projects, quotes, contacts, notes, recentActivity] = await Promise.all([
    listFlowGroupsForTenant(prisma, { tenantId, customerId, limit: SUB_LIST_LIMIT }),
    listCommercialQuoteShellsForTenant(prisma, { tenantId, customerId, limit: SUB_LIST_LIMIT }),
    listCustomerContactsForTenant(prisma, { tenantId, customerId }),
    listCustomerNotesForTenant(prisma, { tenantId, customerId }),
    listCustomerRecentActivityForTenant(prisma, { tenantId, customerId, limit: 25 }),
  ]);
  const contactRows = contacts ?? [];
  const noteRows = notes ?? [];
  const activityItems = recentActivity ?? [];
  const canOfficeMutate = principalHasCapability(auth.principal, "office_mutate");

  const projectsTruncated = customer.flowGroupCount > projects.length;
  const quotesTruncated = customer.quoteCount > quotes.length;

  return (
    <main className="mx-auto max-w-5xl p-8 text-zinc-200">
      <nav className="mb-4 text-xs text-zinc-500">
        <Link href="/customers" className="hover:text-zinc-300">
          Customers
        </Link>
        <span className="mx-2 text-zinc-700">/</span>
        <span className="text-zinc-400">{customer.name}</span>
      </nav>

      <header className="mb-8 border-b border-zinc-800 pb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex flex-wrap items-baseline gap-2 text-2xl font-semibold tracking-tight text-zinc-50">
              <span>{customer.name}</span>
              <span className="rounded border border-zinc-700 bg-zinc-950/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                Office
              </span>
            </h1>
            <p className="mt-2 text-xs text-zinc-500">
              Customer since {formatCreatedDate(customer.createdAt)} · {customer.flowGroupCount}{" "}
              project{customer.flowGroupCount === 1 ? "" : "s"} · {customer.quoteCount} quote
              {customer.quoteCount === 1 ? "" : "s"}. Core customer fields stay on the record; contacts are edited in the
              contacts and notes sections below.
            </p>
          </div>
          <Link href="/customers" className="text-sm text-zinc-500 hover:text-zinc-400">
            ← All customers
          </Link>
        </div>
      </header>

      <div className="mb-10">
        <CustomerRecentActivityPanel customerId={customerId} items={activityItems} />
      </div>

      <div className="mb-10 space-y-10">
        <CustomerContactsPanel
          customerId={customerId}
          initialContacts={contactRows}
          canOfficeMutate={canOfficeMutate}
        />
        <CustomerNotesPanel
          customerId={customerId}
          initialNotes={noteRows}
          canOfficeMutate={canOfficeMutate}
          viewerUserId={auth.principal.userId}
        />
      </div>

      <section className="mb-10 space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Projects
          </h2>
          {projectsTruncated ? (
            <span className="text-[11px] text-zinc-500 italic">
              Showing {projects.length} of {customer.flowGroupCount}
            </span>
          ) : null}
        </div>
        {projects.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950/30 p-6 text-sm text-zinc-500">
            No projects yet for this customer.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/20">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/40 text-[11px] uppercase font-bold tracking-wider text-zinc-500">
                  <th className="px-5 py-3">Project</th>
                  <th className="px-5 py-3 text-right">Quotes</th>
                  <th className="px-5 py-3">Job</th>
                  <th className="px-5 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {projects.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-5 py-4">
                      <Link
                        href={`/projects/${p.id}`}
                        className="font-medium text-zinc-100 hover:text-sky-400 transition-colors"
                      >
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="text-sm font-mono text-zinc-300">{p.quoteCount}</span>
                    </td>
                    <td className="px-5 py-4">
                      {p.jobId ? (
                        <Link
                          href={`/jobs/${p.jobId}`}
                          className="inline-flex items-center rounded border border-emerald-800/60 bg-emerald-950/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300 hover:text-emerald-200"
                        >
                          Activated
                        </Link>
                      ) : (
                        <span className="text-[11px] text-zinc-500 italic">none</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs text-zinc-400">
                      {formatCreatedDate(p.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Quotes</h2>
          {quotesTruncated ? (
            <span className="text-[11px] text-zinc-500 italic">
              Showing {quotes.length} of {customer.quoteCount}
            </span>
          ) : null}
        </div>
        {quotes.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950/30 p-6 text-sm text-zinc-500">
            No quotes yet for this customer.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/20">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/40 text-[11px] uppercase font-bold tracking-wider text-zinc-500">
                  <th className="px-5 py-3">Quote #</th>
                  <th className="px-5 py-3">Project</th>
                  <th className="px-5 py-3">Latest version</th>
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
                      <Link
                        href={`/projects/${q.flowGroup.id}`}
                        className="text-sm text-zinc-300 hover:text-sky-400 transition-colors"
                      >
                        {q.flowGroup.name}
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
