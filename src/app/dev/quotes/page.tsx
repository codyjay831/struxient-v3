import Link from "next/link";
import { getPrisma } from "@/server/db/prisma";
import { listCommercialQuoteShellsForTenant } from "@/server/slice1/reads/commercial-quote-shell-reads";
import { tryGetApiPrincipal } from "@/lib/auth/api-principal";

export const dynamic = "force-dynamic";

const LIST_LIMIT = 80;

/**
 * Server-rendered list using the same principal resolution as other dev pages (session or dev bypass).
 */
export default async function DevQuotesListPage() {
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

  const items = await listCommercialQuoteShellsForTenant(getPrisma(), {
    tenantId: auth.principal.tenantId,
    limit: LIST_LIMIT,
  });

  return (
    <main className="mx-auto max-w-3xl p-8 text-zinc-200">
      <h1 className="mb-2 text-lg font-medium">Quotes (dev)</h1>
      <p className="mb-4 text-sm text-zinc-400">
        Tenant-scoped list (same data as <code className="text-zinc-300">GET /api/quotes</code>). Open draft scope via latest
        version id. Office: <code className="text-zinc-300">POST /api/quotes/&lt;quoteId&gt;/versions</code> clones the
        head version into a new <code className="text-zinc-300">DRAFT</code>.
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">No quotes yet. Create one at /dev/new-quote-shell (office).</p>
      ) : (
        <ul className="space-y-3 text-sm">
          {items.map((row) => {
            const qv = row.latestQuoteVersion;
            return (
              <li key={row.quote.id} className="rounded border border-zinc-800 bg-zinc-950/80 p-3">
                <div className="font-medium text-zinc-100">
                  {row.quote.quoteNumber}{" "}
                  <span className="text-xs font-normal text-zinc-500">({row.quote.id.slice(0, 8)}…)</span>
                </div>
                <div className="mt-1 text-zinc-400">
                  {row.customer.name} · {row.flowGroup.name}
                </div>
                {qv ? (
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="text-zinc-500">
                      v{qv.versionNumber} {qv.status} · {qv.proposalGroupCount} proposal group(s)
                    </span>
                    <Link
                      href={`/dev/quote-scope/${qv.id}`}
                      className="text-sky-400 hover:text-sky-300"
                    >
                      Open quote scope →
                    </Link>
                    <Link
                      href={`/api/quotes/${row.quote.id}`}
                      className="text-zinc-500 hover:text-zinc-400"
                    >
                      JSON detail
                    </Link>
                    <Link
                      href={`/api/quotes/${row.quote.id}/versions`}
                      className="text-zinc-500 hover:text-zinc-400"
                    >
                      Version history (JSON)
                    </Link>
                    <Link
                      href={`/dev/quotes/${row.quote.id}`}
                      className="text-sky-400 hover:text-sky-300"
                    >
                      Workspace (dev)
                    </Link>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-amber-600/90">No versions (unexpected).</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-8 flex flex-wrap gap-3 text-sm">
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
