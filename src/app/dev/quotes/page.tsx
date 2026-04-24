import Link from "next/link";
import { InternalBreadcrumb } from "@/components/internal/internal-breadcrumb";
import { InternalEmptyDiscoveryState } from "@/components/internal/internal-state-feedback";
import { getPrisma } from "@/server/db/prisma";
import { listCommercialQuoteShellsForTenant } from "@/server/slice1/reads/commercial-quote-shell-reads";
import { tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { QuoteVersionStatus } from "@prisma/client";
import { InternalQuickJump } from "@/components/internal/internal-quick-jump";

export const dynamic = "force-dynamic";

const LIST_LIMIT = 80;

function getNextStepHint(status: QuoteVersionStatus, hasActivation: boolean): string | null {
  if (hasActivation) return "Continue in execution";
  switch (status) {
    case "DRAFT":
      return "Review and send";
    case "SENT":
      return "Waiting for signature";
    case "SIGNED":
      return "Ready to activate";
    case "DECLINED":
      return "Customer declined";
    default:
      return null;
  }
}

/**
 * Tenant-scoped discovery for Quote records.
 * The primary entry point for finding and opening commercial records.
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
          ← Hub
        </Link>
      </main>
    );
  }

  const items = await listCommercialQuoteShellsForTenant(getPrisma(), {
    tenantId: auth.principal.tenantId,
    limit: LIST_LIMIT,
  });

  const discoveryLinks = [
    { label: "Customers", href: "/dev/customers" },
    { label: "Flow groups", href: "/dev/flow-groups" },
    { label: "Quotes", href: "/dev/quotes", isActive: true },
    { label: "+ New shell", href: "/dev/new-quote-shell" },
  ];

  return (
    <main className="mx-auto max-w-3xl p-8 text-zinc-200">
      <header className="mb-6 border-b border-zinc-800 pb-5">
        <div className="flex flex-wrap items-start justify-between gap-3 text-sky-400">
          <div>
            <InternalBreadcrumb
              category="Commercial"
              segments={[{ label: "Quotes" }]}
            />
            <h1 className="mt-2 text-xl font-semibold tracking-tight text-zinc-50">Quotes</h1>
            <p className="mt-2 max-w-xl text-xs leading-relaxed text-zinc-500">
              Find and open quote records for this tenant. Each row leads to the quote workspace for
              lifecycle actions or the scope view for detailed inspection.
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
          resourceName="Quotes"
          createInstructions="Quotes are the primary commercial record. Create a new shell to start the commercial workflow."
          action={{ href: "/dev/new-quote-shell", label: "Create a quote shell" }}
        />
      ) : (
        <ul className="space-y-4">
          {items.map((row) => {
            const qv = row.latestQuoteVersion;
            const nextStep = qv ? getNextStepHint(qv.status, qv.hasActivation) : null;
            return (
              <li
                key={row.quote.id}
                className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-base font-semibold text-zinc-50">
                      {row.quote.quoteNumber}
                    </span>
                    {qv && (
                      <span className="text-xs text-zinc-500">
                        v{qv.versionNumber} · {qv.status}
                      </span>
                    )}
                  </div>
                  {nextStep && (
                    <span className="inline-flex items-center rounded border border-sky-800/40 bg-sky-950/30 px-2 py-0.5 text-[10px] font-medium text-sky-300">
                      {nextStep}
                    </span>
                  )}
                </div>

                <div className="mt-1 text-xs text-zinc-400">
                  {row.customer.name} · {row.flowGroup.name}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/dev/quotes/${row.quote.id}`}
                    className="rounded bg-sky-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-600"
                  >
                    Quote workspace
                  </Link>
                  {qv && (
                    <Link
                      href={`/dev/quote-scope/${qv.id}`}
                      className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800"
                    >
                      Quote scope
                    </Link>
                  )}
                  {qv?.flowId && (
                    <Link
                      href={`/dev/work-feed/${qv.flowId}`}
                      className="rounded border border-emerald-800/60 bg-emerald-950/20 px-3 py-1.5 text-xs text-emerald-400 hover:bg-emerald-950/40"
                    >
                      Work feed
                    </Link>
                  )}
                </div>

                <details className="mt-4">
                  <summary className="cursor-pointer text-[10px] text-zinc-500 hover:text-zinc-300 uppercase font-semibold tracking-wider">
                    Technical details
                  </summary>
                  <div className="mt-3 space-y-2">
                    <dl className="grid grid-cols-1 gap-1 text-[11px] text-zinc-500">
                      <div>
                        Quote ID: <code className="text-zinc-400">{row.quote.id}</code>
                      </div>
                      {qv && (
                        <div>
                          Head ID: <code className="text-zinc-400">{qv.id}</code>
                        </div>
                      )}
                    </dl>
                    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] underline text-zinc-500">
                      <li>
                        <Link href={`/api/quotes/${row.quote.id}`}>Quote JSON</Link>
                      </li>
                      <li>
                        <Link href={`/api/quotes/${row.quote.id}/versions`}>Versions JSON</Link>
                      </li>
                    </ul>
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-8 flex flex-wrap gap-3 text-sm">
        <Link href="/dev/new-quote-shell" className="text-sky-400 hover:text-sky-300">
          New quote shell
        </Link>
        <Link href="/dev/flows" className="text-sky-400 hover:text-sky-300">
          Activated flows
        </Link>
        <Link href="/dev/jobs" className="text-sky-400 hover:text-sky-300">
          Jobs
        </Link>
      </div>
    </main>
  );
}
