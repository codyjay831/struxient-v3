import Link from "next/link";
import { getPrisma } from "@/server/db/prisma";
import { listCommercialQuoteShellsForTenant } from "@/server/slice1/reads/commercial-quote-shell-reads";
import { tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { QuoteVersionStatus } from "@prisma/client";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const LIST_LIMIT = 80;

function getNextStepHint(status: QuoteVersionStatus, hasActivation: boolean): string | null {
  if (hasActivation) return "In Execution";
  switch (status) {
    case "DRAFT":
      return "Needs Review";
    case "SENT":
      return "Waiting on Customer";
    case "SIGNED":
      return "Ready to Activate";
    default:
      return null;
  }
}

function getStatusColor(status: QuoteVersionStatus, hasActivation: boolean): string {
    if (hasActivation) return "text-emerald-400 bg-emerald-950/30 border-emerald-800/50";
    switch (status) {
        case "DRAFT": return "text-amber-400 bg-amber-950/30 border-amber-800/50";
        case "SENT": return "text-sky-400 bg-sky-950/30 border-sky-800/50";
        case "SIGNED": return "text-indigo-400 bg-indigo-950/30 border-indigo-800/50";
        default: return "text-zinc-400 bg-zinc-950/30 border-zinc-800/50";
    }
}

export default async function OfficeQuotesListPage() {
  const auth = await tryGetApiPrincipal();

  if (!auth.ok) {
    redirect("/dev/login");
  }

  const items = await listCommercialQuoteShellsForTenant(getPrisma(), {
    tenantId: auth.principal.tenantId,
    limit: LIST_LIMIT,
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-50">Quotes</h1>
          <p className="text-sm text-zinc-500 mt-1">Manage and track your commercial engagement lifecycle.</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <h2 className="text-zinc-200 font-medium">No quotes found</h2>
          <p className="text-zinc-500 text-sm mt-1 mb-6">Get started by creating your first commercial quote shell.</p>
          <Link 
            href="/dev/new-quote-shell" 
            className="inline-flex items-center px-4 py-2 bg-sky-700 hover:bg-sky-600 text-white rounded-md text-sm font-medium transition-colors"
          >
            Create Quote Shell
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/20">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/40 text-[11px] uppercase font-bold tracking-wider text-zinc-500">
                <th className="px-6 py-4">Quote Number</th>
                <th className="px-6 py-4">Customer & Project</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Next Step</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {items.map((row) => {
                const qv = row.latestQuoteVersion;
                const nextStep = qv ? getNextStepHint(qv.status, qv.hasActivation) : null;
                const statusColor = qv ? getStatusColor(qv.status, qv.hasActivation) : "";
                
                return (
                  <tr key={row.quote.id} className="hover:bg-zinc-800/30 transition-colors group">
                    <td className="px-6 py-5">
                      <Link href={`/quotes/${row.quote.id}`} className="font-semibold text-zinc-50 hover:text-sky-400 transition-colors">
                        {row.quote.quoteNumber}
                      </Link>
                      {qv && (
                        <div className="text-[10px] text-zinc-500 font-mono mt-0.5">v{qv.versionNumber}</div>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <div className="text-sm font-medium text-zinc-200">{row.customer.name}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">{row.flowGroup.name}</div>
                    </td>
                    <td className="px-6 py-5">
                      {qv ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${statusColor}`}>
                          {qv.hasActivation ? "Active" : qv.status}
                        </span>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      {nextStep ? (
                        <span className="text-xs text-zinc-400">{nextStep}</span>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <Link 
                        href={`/quotes/${row.quote.id}`} 
                        className="inline-flex items-center px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-zinc-50 rounded text-xs font-medium transition-all"
                      >
                        Workspace
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
