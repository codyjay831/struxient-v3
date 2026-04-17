import Link from "next/link";
import { getPrisma } from "@/server/db/prisma";
import { listFlowGroupsForTenant } from "@/server/slice1/reads/flow-group-reads";
import { tryGetApiPrincipal } from "@/lib/auth/api-principal";

export const dynamic = "force-dynamic";

const LIST_LIMIT = 100;

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
          ← Home
        </Link>
      </main>
    );
  }

  const items = await listFlowGroupsForTenant(getPrisma(), {
    tenantId: auth.principal.tenantId,
    limit: LIST_LIMIT,
  });

  return (
    <main className="mx-auto max-w-3xl p-8 text-zinc-200">
      <h1 className="mb-2 text-lg font-medium">Flow groups (dev)</h1>
      <p className="mb-4 text-sm text-zinc-400">
        Same data as <code className="text-zinc-300">GET /api/flow-groups</code>. Use <code className="text-zinc-300">id</code> with{" "}
        <code className="text-zinc-300">customer.id</code> for attach <code className="text-zinc-300">POST /api/commercial/quote-shell</code>{" "}
        (<code className="text-zinc-300">customerId</code> + <code className="text-zinc-300">flowGroupId</code>).
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">No flow groups in this tenant yet.</p>
      ) : (
        <ul className="space-y-3 text-sm">
          {items.map((row) => (
            <li key={row.id} className="rounded border border-zinc-800 bg-zinc-950/80 p-3">
              <div className="font-medium text-zinc-100">{row.name}</div>
              <div className="mt-1 text-zinc-400">
                Customer: {row.customer.name}{" "}
                <span className="text-xs text-zinc-500">
                  (<code className="text-zinc-400">{row.customer.id}</code>)
                </span>
              </div>
              <div className="mt-1 font-mono text-xs text-zinc-500">
                <code className="text-zinc-400">{row.id}</code>
              </div>
              <div className="mt-1 text-zinc-500">
                {row.quoteCount} quote(s)
                {row.jobId ? (
                  <>
                    {" "}
                    · job <code className="text-zinc-400">{row.jobId}</code>
                  </>
                ) : (
                  " · no job yet"
                )}
              </div>
              <Link href={`/api/flow-groups/${row.id}`} className="mt-2 inline-block text-xs text-sky-400 hover:text-sky-300">
                JSON detail
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-8 flex flex-wrap gap-3 text-sm">
        <Link href="/dev/customers" className="text-sky-400 hover:text-sky-300">
          Customers
        </Link>
        <Link href="/dev/new-quote-shell" className="text-sky-400 hover:text-sky-300">
          New quote shell
        </Link>
        <Link href="/" className="text-zinc-500 hover:text-zinc-400">
          ← Home
        </Link>
      </div>
    </main>
  );
}
