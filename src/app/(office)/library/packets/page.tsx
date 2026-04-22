import Link from "next/link";
import { redirect } from "next/navigation";
import { principalHasCapability, tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { getPrisma } from "@/server/db/prisma";
import { listScopePacketsForTenant } from "@/server/slice1/reads/scope-packet-catalog-reads";

/**
 * Office-surface library index for catalog ScopePackets.
 *
 * Reuses `listScopePacketsForTenant` — the same tenant-scoped read model the
 * `/dev/catalog-packets` index consumes. Greenfield create: `/library/packets/new`
 * (`office_mutate`). Task-line authoring APIs in office remain deferred; revision pages are inspect-first.
 */
export const dynamic = "force-dynamic";

const LIST_LIMIT = 200;

export default async function OfficeLibraryPacketsPage() {
  const auth = await tryGetApiPrincipal();
  if (!auth.ok) {
    redirect("/login");
  }

  const items = await listScopePacketsForTenant(getPrisma(), {
    tenantId: auth.principal.tenantId,
    limit: LIST_LIMIT,
  });

  const canAuthor = principalHasCapability(auth.principal, "office_mutate");

  return (
    <div className="p-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-50">Library packets</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Catalog ScopePackets visible to your tenant. Each packet groups one or more revisions
            of authored task lines and is referenced by quote line items.
          </p>
        </div>
        {canAuthor ? (
          <Link
            href="/library/packets/new"
            className="shrink-0 rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600 transition-colors"
          >
            New packet
          </Link>
        ) : null}
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
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          </div>
          <h2 className="text-zinc-200 font-medium">No catalog packets yet</h2>
          <p className="text-zinc-500 text-sm mt-1 max-w-sm mx-auto">
            {canAuthor ? (
              <>
                Create a packet directly with{" "}
                <Link href="/library/packets/new" className="text-sky-400 hover:text-sky-300">
                  New packet
                </Link>
                , or promote a quote-local packet from a quote scope page.
              </>
            ) : (
              <>
                Catalog packets appear here after promotion from a quote scope page, or when an office admin creates one
                in the library.
              </>
            )}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/20">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/40 text-[11px] uppercase font-bold tracking-wider text-zinc-500">
                <th className="px-6 py-4">Packet</th>
                <th className="px-6 py-4 text-right">Published</th>
                <th className="px-6 py-4 text-right">Total revisions</th>
                <th className="px-6 py-4">Latest published</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {items.map((packet) => {
                const hasPublished = packet.latestPublishedRevisionNumber != null;
                return (
                  <tr key={packet.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-6 py-5">
                      <Link
                        href={`/library/packets/${packet.id}`}
                        className="font-semibold text-zinc-50 hover:text-sky-400 transition-colors"
                      >
                        {packet.displayName}
                      </Link>
                      <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                        {packet.packetKey}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <span className="text-sm font-mono text-zinc-300">
                        {packet.publishedRevisionCount}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <span className="text-sm font-mono text-zinc-300">
                        {packet.revisionCount}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      {hasPublished ? (
                        <span className="text-xs text-zinc-300">
                          r{packet.latestPublishedRevisionNumber}
                        </span>
                      ) : (
                        <span className="text-xs text-amber-400/80 italic">none</span>
                      )}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <Link
                        href={`/library/packets/${packet.id}`}
                        className="inline-flex items-center px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-zinc-50 rounded text-xs font-medium transition-all"
                      >
                        Open
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
