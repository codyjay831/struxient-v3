import Link from "next/link";
import { InternalBreadcrumb } from "@/components/internal/internal-breadcrumb";
import { InternalEmptyDiscoveryState } from "@/components/internal/internal-state-feedback";
import { getPrisma } from "@/server/db/prisma";
import { listFlowGroupsForTenant } from "@/server/slice1/reads/flow-group-reads";
import { tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { InternalQuickJump } from "@/components/internal/internal-quick-jump";

export const dynamic = "force-dynamic";

const LIST_LIMIT = 80;

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().replace("T", " ").replace(/\..+$/, " UTC");
}

/**
 * Tenant-scoped discovery for Flow Group records.
 * Flow groups organize commercial and execution context for one or more quotes.
 */
export default async function DevFlowGroupsListPage() {
  const auth = await tryGetApiPrincipal();

  if (!auth.ok) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <p className="text-zinc-300">
          Sign in at{" "}
          <Link href="/dev/login" className="text-sky-400">
            /dev/login
          </Link>{" "}
          or enable dev auth bypass (see .env.example).
        </p>
        <Link href="/" className="mt-4 inline-block text-sm text-sky-400">
          ← Hub
        </Link>
      </main>
    );
  }

  const items = await listFlowGroupsForTenant(getPrisma(), {
    tenantId: auth.principal.tenantId,
    limit: LIST_LIMIT,
  });

  const discoveryLinks = [
    { label: "Customers", href: "/dev/customers" },
    { label: "Flow groups", href: "/dev/flow-groups", isActive: true },
    { label: "Quotes", href: "/dev/quotes" },
    { label: "+ New shell", href: "/dev/new-quote-shell" },
  ];

  return (
    <main className="mx-auto max-w-3xl p-8 text-zinc-200">
      <header className="mb-6 border-b border-zinc-800 pb-5">
        <div className="flex flex-wrap items-start justify-between gap-3 text-sky-400">
          <div>
            <InternalBreadcrumb
              category="Commercial"
              segments={[{ label: "Flow groups" }]}
            />
            <h1 className="mt-2 text-xl font-semibold tracking-tight text-zinc-50">Flow groups</h1>
            <p className="mt-2 max-w-xl text-xs leading-relaxed text-zinc-500">
              Tenant-scoped list of flow groups. Each group anchors a customer engagement and serves
              as the container for quote versions and the stable Job record after activation.
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
          resourceName="Flow groups"
          createInstructions="Flow groups serve as the container for quote versions and are created during shell initialization."
          action={{ href: "/dev/new-quote-shell", label: "Create a quote shell" }}
        />
      ) : (
        <ul className="space-y-4">
          {items.map((row) => (
            <li
              key={row.id}
              className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-base font-semibold text-zinc-50">{row.name}</div>
                <span className="text-[10px] font-medium text-zinc-500 uppercase">
                  Created {formatTimestamp(row.createdAt)}
                </span>
              </div>

              <div className="mt-1 text-xs text-zinc-400">
                Customer: <span className="text-zinc-300 font-medium">{row.customer.name}</span>
              </div>

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-500">
                <span>
                  <span className="text-zinc-600 font-semibold uppercase tracking-tighter">Quotes:</span>{" "}
                  {row.quoteCount}
                </span>
                <span>
                  <span className="text-zinc-600 font-semibold uppercase tracking-tighter">Job:</span>{" "}
                  {row.jobId ? (
                    <Link
                      href={`/dev/jobs/${row.jobId}`}
                      className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
                    >
                      {row.jobId.slice(0, 10)}…
                    </Link>
                  ) : (
                    <span className="italic text-zinc-600">none yet</span>
                  )}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <Link
                  href="/dev/quotes"
                  className="rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-zinc-200 hover:bg-zinc-800"
                >
                  View quotes
                </Link>
                <Link
                  href="/dev/customers"
                  className="rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-zinc-200 hover:bg-zinc-800"
                >
                  Customer detail
                </Link>
              </div>

              <details className="mt-4 border-t border-zinc-800/40 pt-3">
                <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wider text-zinc-600 hover:text-zinc-400">
                  Technical details
                </summary>
                <dl className="mt-2 space-y-1 text-[11px] text-zinc-500">
                  <div>
                    Group ID: <code className="text-zinc-400 font-mono">{row.id}</code>
                  </div>
                  <div>
                    Customer ID: <code className="text-zinc-400 font-mono">{row.customer.id}</code>
                  </div>
                  <div>
                    <Link
                      href={`/api/flow-groups/${row.id}`}
                      className="text-sky-400 hover:text-sky-300 underline"
                    >
                      GET /api/flow-groups/{row.id.slice(0, 10)}… (JSON)
                    </Link>
                  </div>
                </dl>
              </details>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8 flex flex-wrap gap-3 text-sm">
        <Link href="/dev/new-quote-shell" className="text-sky-400 hover:text-sky-300">
          New quote shell
        </Link>
        <Link href="/dev/quotes" className="text-sky-400 hover:text-sky-300">
          Quote list
        </Link>
        <Link href="/dev/customers" className="text-sky-400 hover:text-sky-300">
          Customers
        </Link>
      </div>
    </main>
  );
}
