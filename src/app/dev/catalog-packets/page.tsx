import Link from "next/link";
import { InternalBreadcrumb } from "@/components/internal/internal-breadcrumb";
import { InternalSparseState } from "@/components/internal/internal-state-feedback";
import { tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { getPrisma } from "@/server/db/prisma";
import { listScopePacketsForTenant } from "@/server/slice1/reads/scope-packet-catalog-reads";
import { SCOPE_PACKET_LIST_LIMIT_DEFAULTS } from "@/lib/scope-packet-catalog-summary";

export const dynamic = "force-dynamic";

const LIST_LIMIT = 100;

export default async function DevCatalogPacketsPage() {
  const auth = await tryGetApiPrincipal();
  if (!auth.ok) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <p className="text-zinc-300">
          Sign in at{" "}
          <Link href="/dev/login" className="text-sky-400">
            /dev/login
          </Link>{" "}
          or enable dev auth bypass.
        </p>
        <Link href="/" className="mt-4 inline-block text-sm text-sky-400">
          ← Hub
        </Link>
      </main>
    );
  }

  const items = await listScopePacketsForTenant(getPrisma(), {
    tenantId: auth.principal.tenantId,
    limit: LIST_LIMIT,
  });

  return (
    <main className="mx-auto max-w-4xl p-8 text-zinc-200">
      <header className="mb-6 border-b border-zinc-800 pb-5">
        <div className="flex flex-wrap items-start justify-between gap-3 text-sky-400">
          <div>
            <InternalBreadcrumb category="Commercial" segments={[{ label: "Catalog packets" }]} />
            <h1 className="mt-2 text-xl font-semibold tracking-tight text-zinc-50">
              Catalog packets
            </h1>
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-zinc-500">
              Tenant-scoped library of reusable scope packets. This surface is{" "}
              <span className="font-semibold text-zinc-300">read-only</span> — packet authoring,
              revision lifecycle, promotion from quote-local packets, and tier registry are not
              available here yet. Catalog rows currently come from seed data only.
            </p>
          </div>
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-400">
            ← Hub
          </Link>
        </div>
      </header>

      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href="/api/scope-packets"
          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
        >
          Raw JSON
        </Link>
      </div>

      {items.length === 0 ? (
        <InternalSparseState
          message="No catalog packets in this tenant"
          hint={`Seed data populates one packet by default; an empty result here means the seed has not been run or this tenant has no ScopePacket rows. Up to ${LIST_LIMIT} rows are loaded.`}
        />
      ) : (
        <ul className="space-y-3">
          {items.map((row) => (
            <li
              key={row.id}
              className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-base font-semibold text-zinc-50">{row.displayName}</span>
                  <code className="text-xs text-zinc-500">{row.packetKey}</code>
                </div>
                <span className="inline-flex items-center rounded border border-zinc-700 bg-zinc-950/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                  Read-only
                </span>
              </div>

              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-500">
                <span>
                  {row.publishedRevisionCount} published / {row.revisionCount} total revision
                  {row.revisionCount === 1 ? "" : "s"}
                </span>
                {row.latestPublishedRevisionNumber != null ? (
                  <span>
                    Latest published: r{row.latestPublishedRevisionNumber}
                    {row.latestPublishedAtIso ? ` · ${row.latestPublishedAtIso}` : ""}
                  </span>
                ) : (
                  <span className="text-amber-400/80">No published revision</span>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={`/dev/catalog-packets/${row.id}`}
                  className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800"
                >
                  Open packet
                </Link>
                {row.latestPublishedRevisionId ? (
                  <Link
                    href={`/dev/catalog-packets/${row.id}/revisions/${row.latestPublishedRevisionId}`}
                    className="rounded border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-[11px] text-zinc-400 hover:text-zinc-200"
                  >
                    Latest revision
                  </Link>
                ) : null}
                <Link
                  href={`/api/scope-packets/${row.id}`}
                  className="rounded border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-[11px] text-zinc-500 hover:text-zinc-300"
                >
                  JSON
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      <details className="mt-8 rounded-lg border border-dashed border-zinc-800 bg-zinc-950/30 p-4">
        <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-400">
          Technical details
        </summary>
        <div className="mt-3 space-y-1 text-[11px] leading-relaxed text-zinc-500">
          <p>
            List: <code className="text-zinc-400">GET /api/scope-packets</code> — supports{" "}
            <code className="text-zinc-400">?limit</code> (default{" "}
            {SCOPE_PACKET_LIST_LIMIT_DEFAULTS.default}, max{" "}
            {SCOPE_PACKET_LIST_LIMIT_DEFAULTS.max}).
          </p>
          <p>
            Detail: <code className="text-zinc-400">GET /api/scope-packets/&lt;id&gt;</code>.
          </p>
          <p>
            Revision detail:{" "}
            <code className="text-zinc-400">
              GET /api/scope-packets/&lt;id&gt;/revisions/&lt;revisionId&gt;
            </code>
            .
          </p>
          <p>
            All routes are <code className="text-zinc-400">read</code>-gated and tenant-scoped via{" "}
            <code className="text-zinc-400">ScopePacket.tenantId</code>. No mutation routes are
            exposed here.
          </p>
        </div>
      </details>
    </main>
  );
}
