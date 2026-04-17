import Link from "next/link";
import { getPrisma } from "@/server/db/prisma";
import { listCustomersForTenant } from "@/server/slice1/reads/customer-reads";
import { tryGetApiPrincipal } from "@/lib/auth/api-principal";

export const dynamic = "force-dynamic";

const LIST_LIMIT = 100;

export default async function DevCustomersListPage() {
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

  const items = await listCustomersForTenant(getPrisma(), {
    tenantId: auth.principal.tenantId,
    limit: LIST_LIMIT,
  });

  return (
    <main className="mx-auto max-w-3xl p-8 text-zinc-200">
      <h1 className="mb-2 text-lg font-medium">Customers (dev)</h1>
      <p className="mb-4 text-sm text-zinc-400">
        Same data as <code className="text-zinc-300">GET /api/customers</code>. Use <code className="text-zinc-300">id</code> for
        attach-mode <code className="text-zinc-300">POST /api/commercial/quote-shell</code> (<code className="text-zinc-300">customerId</code>
        ).
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">No customers in this tenant yet.</p>
      ) : (
        <ul className="space-y-3 text-sm">
          {items.map((row) => (
            <li key={row.id} className="rounded border border-zinc-800 bg-zinc-950/80 p-3">
              <div className="font-medium text-zinc-100">{row.name}</div>
              <div className="mt-1 text-xs text-zinc-500">
                <code className="text-zinc-400">{row.id}</code>
              </div>
              <div className="mt-1 text-zinc-500">
                {row.flowGroupCount} flow group(s), {row.quoteCount} quote(s) · {row.createdAt}
              </div>
              <Link href={`/api/customers/${row.id}`} className="mt-2 inline-block text-xs text-sky-400 hover:text-sky-300">
                JSON detail
              </Link>
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
        <Link href="/" className="text-zinc-500 hover:text-zinc-400">
          ← Home
        </Link>
      </div>
    </main>
  );
}
