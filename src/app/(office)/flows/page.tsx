import Link from "next/link";
import { redirect } from "next/navigation";
import { QuoteVersionStatus } from "@prisma/client";
import { getPrisma } from "@/server/db/prisma";
import { listFlowsForTenant } from "@/server/slice1/reads/flow-discovery-reads";
import { tryGetApiPrincipal } from "@/lib/auth/api-principal";

/**
 * Office-surface discovery for activated execution records (Flow rows).
 *
 * Reuses `listFlowsForTenant` — the same tenant-scoped read model the
 * `/dev/flows` page and the `/api/flows` route consume — so this surface
 * never invents new flow semantics. Every Flow row exists because the
 * activate path created it (canon: `Activation.flowId @unique`,
 * `Flow.quoteVersionId @unique`), so listing Flow rows is the canonical
 * way to enumerate live execution for a tenant.
 *
 * Read-only on purpose: the office work happens on `/flows/[flowId]`; this
 * page is the discovery / index surface only.
 */
export const dynamic = "force-dynamic";

const LIST_LIMIT = 80;

function formatActivatedDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getActivationLabel(activation: { activatedAt: string } | null): string {
  return activation ? "Activated" : "Not Activated";
}

function getActivationStyle(activation: { activatedAt: string } | null): string {
  return activation
    ? "text-emerald-400 bg-emerald-950/30 border-emerald-800/50"
    : "text-amber-400 bg-amber-950/30 border-amber-800/50";
}

function getQuoteVersionLabel(status: QuoteVersionStatus): string {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "SENT":
      return "Sent";
    case "SIGNED":
      return "Signed";
    default:
      return status;
  }
}

export default async function OfficeFlowsListPage() {
  const auth = await tryGetApiPrincipal();

  if (!auth.ok) {
    redirect("/login");
  }

  const items = await listFlowsForTenant(getPrisma(), {
    tenantId: auth.principal.tenantId,
    limit: LIST_LIMIT,
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-50">Flows</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Activated execution records. Every flow was created by activating a signed quote version
            and is the entry point to its work feed.
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
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <h2 className="text-zinc-200 font-medium">No activated flows yet</h2>
          <p className="text-zinc-500 text-sm mt-1 mb-6 max-w-sm mx-auto">
            Flows appear here after a signed quote version is activated. Open a signed quote and
            activate its execution to create one.
          </p>
          <Link
            href="/quotes"
            className="inline-flex items-center px-4 py-2 bg-sky-700 hover:bg-sky-600 text-white rounded-md text-sm font-medium transition-colors"
          >
            Open Quotes
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/20">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/40 text-[11px] uppercase font-bold tracking-wider text-zinc-500">
                <th className="px-6 py-4">Quote</th>
                <th className="px-6 py-4">Customer &amp; Project</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Runtime Tasks</th>
                <th className="px-6 py-4">Activated</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {items.map((item) => {
                const activatedDisplay = item.activation
                  ? formatActivatedDate(item.activation.activatedAt)
                  : "—";
                const statusLabel = getActivationLabel(item.activation);
                const statusStyle = getActivationStyle(item.activation);
                const versionLabel = getQuoteVersionLabel(item.quoteVersion.status);

                return (
                  <tr
                    key={item.flow.id}
                    className="hover:bg-zinc-800/30 transition-colors"
                  >
                    <td className="px-6 py-5">
                      <Link
                        href={`/flows/${item.flow.id}`}
                        className="font-semibold text-zinc-50 hover:text-sky-400 transition-colors"
                      >
                        {item.quote.quoteNumber}
                      </Link>
                      <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                        v{item.quoteVersion.versionNumber} · {versionLabel}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="text-sm font-medium text-zinc-200">{item.customer.name}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">{item.flowGroup.name}</div>
                    </td>
                    <td className="px-6 py-5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${statusStyle}`}
                      >
                        {statusLabel}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <span className="text-sm font-mono text-zinc-300">
                        {item.runtimeTaskCount}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-xs text-zinc-400">{activatedDisplay}</span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <Link
                        href={`/flows/${item.flow.id}`}
                        className="inline-flex items-center px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-zinc-50 rounded text-xs font-medium transition-all"
                      >
                        Work Feed
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
