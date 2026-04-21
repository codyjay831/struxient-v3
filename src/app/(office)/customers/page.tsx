import Link from "next/link";
import { redirect } from "next/navigation";
import { tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { getPrisma } from "@/server/db/prisma";
import { listCustomersForTenant } from "@/server/slice1/reads/customer-reads";

/**
 * Office customers index. Read-only.
 *
 * Reuses `listCustomersForTenant` — same tenant-scoped read consumed by
 * `/dev/customers`. Customer records are the primary commercial anchor for
 * projects (FlowGroups) and quotes; this index is the operator-facing entry
 * point into that relationship layer.
 */
export const dynamic = "force-dynamic";

const LIST_LIMIT = 200;

function formatCreatedDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

export default async function OfficeCustomersListPage() {
  const auth = await tryGetApiPrincipal();
  if (!auth.ok) {
    redirect("/login");
  }

  const items = await listCustomersForTenant(getPrisma(), {
    tenantId: auth.principal.tenantId,
    limit: LIST_LIMIT,
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-50">Customers</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Tenant-scoped customer records. Each customer can anchor multiple projects and quotes.
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
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h2 className="text-zinc-200 font-medium">No customers yet</h2>
          <p className="text-zinc-500 text-sm mt-1 max-w-sm mx-auto">
            Customers appear here once a quote shell is created against them. Start a new quote
            to add your first customer.
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
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4 text-right">Projects</th>
                <th className="px-6 py-4 text-right">Quotes</th>
                <th className="px-6 py-4">Created</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {items.map((customer) => (
                <tr key={customer.id} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="px-6 py-5">
                    <Link
                      href={`/customers/${customer.id}`}
                      className="font-semibold text-zinc-50 hover:text-sky-400 transition-colors"
                    >
                      {customer.name}
                    </Link>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <span className="text-sm font-mono text-zinc-300">
                      {customer.flowGroupCount}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <span className="text-sm font-mono text-zinc-300">{customer.quoteCount}</span>
                  </td>
                  <td className="px-6 py-5">
                    <span className="text-xs text-zinc-400">
                      {formatCreatedDate(customer.createdAt)}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <Link
                      href={`/customers/${customer.id}`}
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
