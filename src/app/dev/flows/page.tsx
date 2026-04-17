import Link from "next/link";
import { getPrisma } from "@/server/db/prisma";
import { listFlowsForTenant } from "@/server/slice1/reads/flow-discovery-reads";
import { tryGetApiPrincipal } from "@/lib/auth/api-principal";

export const dynamic = "force-dynamic";

const LIST_LIMIT = 80;

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().replace("T", " ").replace(/\..+$/, " UTC");
}

/**
 * Tenant-scoped discovery for activated execution records (Flow rows).
 * Reuses the same principal resolution as other dev pages (session or dev bypass).
 */
export default async function DevFlowsListPage() {
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
          ← Testing hub
        </Link>
      </main>
    );
  }

  const items = await listFlowsForTenant(getPrisma(), {
    tenantId: auth.principal.tenantId,
    limit: LIST_LIMIT,
  });

  return (
    <main className="mx-auto max-w-3xl p-8 text-zinc-200">
      <header className="mb-6 flex items-end justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Execution discovery
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-zinc-50">
            Activated flows
          </h1>
          <p className="mt-2 max-w-xl text-xs leading-relaxed text-zinc-500">
            Tenant-scoped list of execution records created by activating a signed quote. Open a flow to
            inspect skeleton + runtime tasks, or jump into the work feed.
          </p>
        </div>
        <Link href="/" className="text-sm text-sky-400 hover:text-sky-300">
          ← Hub
        </Link>
      </header>

      {items.length === 0 ? (
        <section className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950/30 p-6 text-center">
          <p className="text-sm text-zinc-300">No activated flows yet</p>
          <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-zinc-500">
            Activate a quote from its workspace to create an execution record. Until then, this list will be
            empty.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3 text-xs">
            <Link
              href="/dev/quotes"
              className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-zinc-200 hover:bg-zinc-800"
            >
              Open quote list
            </Link>
            <Link
              href="/dev/new-quote-shell"
              className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-zinc-200 hover:bg-zinc-800"
            >
              New quote shell
            </Link>
          </div>
        </section>
      ) : (
        <ul className="space-y-3 text-sm">
          {items.map((item) => {
            const activatedDisplay = item.activation
              ? formatTimestamp(item.activation.activatedAt)
              : formatTimestamp(item.flow.createdAt);
            return (
              <li
                key={item.flow.id}
                className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-base font-semibold text-zinc-50">
                      {item.quote.quoteNumber}
                    </span>
                    <span className="text-xs text-zinc-500">
                      v{item.quoteVersion.versionNumber} · {item.quoteVersion.status}
                    </span>
                  </div>
                  <span
                    className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      item.activation
                        ? "border-emerald-800/80 bg-emerald-950/50 text-emerald-300"
                        : "border-amber-800/80 bg-amber-950/50 text-amber-300"
                    }`}
                  >
                    {item.activation ? "Activated" : "Flow only"}
                  </span>
                </div>

                <div className="mt-1 text-xs text-zinc-400">
                  {item.customer.name} · {item.flowGroup.name}
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-zinc-500 sm:grid-cols-4">
                  <div>
                    <dt className="uppercase tracking-tight text-zinc-600">Activated</dt>
                    <dd className="text-zinc-300">{activatedDisplay}</dd>
                  </div>
                  <div>
                    <dt className="uppercase tracking-tight text-zinc-600">Runtime tasks</dt>
                    <dd className="text-zinc-300">{item.runtimeTaskCount}</dd>
                  </div>
                  <div>
                    <dt className="uppercase tracking-tight text-zinc-600">Workflow</dt>
                    <dd className="text-zinc-300">v{item.workflowVersion.versionNumber}</dd>
                  </div>
                  <div>
                    <dt className="uppercase tracking-tight text-zinc-600">Job</dt>
                    <dd className="font-mono text-zinc-400">{item.flow.jobId.slice(0, 10)}…</dd>
                  </div>
                </dl>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/dev/work-feed/${item.flow.id}`}
                    className="rounded bg-sky-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-600"
                  >
                    Open work feed
                  </Link>
                  <Link
                    href={`/dev/flow/${item.flow.id}`}
                    className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800"
                  >
                    Open flow detail
                  </Link>
                  <Link
                    href={`/dev/quotes/${item.quote.id}`}
                    className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800"
                  >
                    Source quote workspace
                  </Link>
                </div>

                <details className="mt-3">
                  <summary className="cursor-pointer text-[11px] text-zinc-500 hover:text-zinc-300">
                    Technical details
                  </summary>
                  <dl className="mt-2 space-y-1 text-[11px] text-zinc-500">
                    <div>
                      Flow: <code className="text-zinc-400">{item.flow.id}</code>
                    </div>
                    <div>
                      Quote version: <code className="text-zinc-400">{item.quoteVersion.id}</code>
                    </div>
                    <div>
                      Job: <code className="text-zinc-400">{item.flow.jobId}</code>
                    </div>
                    {item.activation ? (
                      <div>
                        Activation: <code className="text-zinc-400">{item.activation.id}</code>
                      </div>
                    ) : null}
                    <div>
                      <Link
                        href={`/api/flows/${item.flow.id}`}
                        className="text-sky-400 hover:text-sky-300"
                      >
                        GET /api/flows/{item.flow.id.slice(0, 10)}… (JSON)
                      </Link>
                    </div>
                  </dl>
                </details>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-8 flex flex-wrap gap-3 text-sm">
        <Link href="/dev/quotes" className="text-sky-400 hover:text-sky-300">
          Quote list
        </Link>
        <Link href="/" className="text-zinc-500 hover:text-zinc-400">
          ← Testing hub
        </Link>
      </div>
    </main>
  );
}
