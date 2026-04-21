import Link from "next/link";
import { InternalBreadcrumb } from "@/components/internal/internal-breadcrumb";
import { InternalNotFoundState, InternalSparseState } from "@/components/internal/internal-state-feedback";
import { PrismaClientInitializationError } from "@prisma/client/runtime/library";
import { getPrisma } from "@/server/db/prisma";
import { getQuoteVersionScopeReadModel } from "@/server/slice1/reads/quote-version-scope";
import { getQuoteWorkspaceForTenant } from "@/server/slice1/reads/quote-workspace-reads";
import { InvariantViolationError } from "@/server/slice1/errors";
import { principalHasCapability, tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { toQuoteVersionScopeApiDto } from "@/lib/quote-version-scope-dto";
import { getQuoteVersionLifecycleReadModel } from "@/server/slice1/reads/quote-version-lifecycle";
import { toQuoteVersionLifecycleApiDto } from "@/lib/quote-version-lifecycle-dto";
import { InternalQuickJump } from "@/components/internal/internal-quick-jump";
import { listQuoteLocalPacketsForVersion } from "@/server/slice1/reads/quote-local-packet-reads";
import { QuoteLocalPacketEditor } from "@/components/quote-scope/quote-local-packet-editor";

type PageProps = { params: Promise<{ quoteVersionId: string }> };

export const dynamic = "force-dynamic";

export default async function DevQuoteScopePage({ params }: PageProps) {
  const { quoteVersionId } = await params;
  const auth = await tryGetApiPrincipal();

  if (!auth.ok) {
    return (
      <main className="mx-auto max-w-2xl space-y-4 p-8">
        <p className="text-zinc-300">
          Sign in at <Link href="/dev/login" className="text-sky-400">/dev/login</Link> or enable dev auth
          bypass (see .env.example).
        </p>
        <Link href="/" className="inline-block text-sm text-sky-400">
          ← Hub
        </Link>
      </main>
    );
  }

  try {
    const prisma = getPrisma();
    const scopeModel = await getQuoteVersionScopeReadModel(prisma, {
      tenantId: auth.principal.tenantId,
      quoteVersionId,
    });

    if (!scopeModel) {
      return (
        <main className="mx-auto max-w-4xl px-4 py-8 text-zinc-200 sm:px-6 lg:px-8">
          <header className="mb-6 border-b border-zinc-800 pb-5">
            <InternalBreadcrumb
              category="Commercial"
              segments={[{ label: "Quotes", href: "/dev/quotes" }, { label: "Scope not found" }]}
            />
          </header>
          <InternalNotFoundState
            title="Quote scope not found"
            message="This quote version is not visible to your tenant. It may belong to another tenant or no longer exist."
            backLink={{ href: "/dev/quotes", label: "← All quotes" }}
          />
        </main>
      );
    }

    const [lifecycleModel, workspaceModel, localPackets] = await Promise.all([
      getQuoteVersionLifecycleReadModel(prisma, {
        tenantId: auth.principal.tenantId,
        quoteVersionId,
      }),
      getQuoteWorkspaceForTenant(prisma, {
        tenantId: auth.principal.tenantId,
        quoteId: scopeModel.quoteId,
      }),
      listQuoteLocalPacketsForVersion(prisma, {
        tenantId: auth.principal.tenantId,
        quoteVersionId,
      }),
    ]);
    const isDraft = scopeModel.status === "DRAFT";
    const canOfficeMutate = principalHasCapability(auth.principal, "office_mutate");

    const dto = toQuoteVersionScopeApiDto(scopeModel);
    const lifecycleDto = lifecycleModel ? toQuoteVersionLifecycleApiDto(lifecycleModel) : null;
    const isLatest = workspaceModel?.latestQuoteVersionId === quoteVersionId;

    const quickJumpLinks = [
      {
        label: "Quote workspace",
        href: `/dev/quotes/${dto.quoteVersion.quoteId}`,
        variant: "sky" as const,
      },
      { label: "All quotes", href: "/dev/quotes" },
      { label: "Customers", href: "/dev/customers" },
      { label: "Flow groups", href: "/dev/flow-groups" },
      ...(lifecycleDto?.flow
        ? [
            {
              label: "Flow detail",
              href: `/dev/flow/${lifecycleDto.flow.id}`,
            },
          ]
        : []),
      ...(lifecycleDto?.job
        ? [
            {
              label: "Job anchor",
              href: `/dev/jobs/${lifecycleDto.job.id}`,
              variant: "emerald" as const,
            },
          ]
        : []),
    ];

    const itemsByGroup = dto.proposalGroups.map((group) => ({
      ...group,
      items: dto.orderedLineItems.filter((item) => item.proposalGroupId === group.id),
    }));

    return (
      <main className="mx-auto max-w-4xl px-4 py-8 text-zinc-200 sm:px-6 lg:px-8">
        <header className="mb-6 border-b border-zinc-800 pb-5">
          <InternalBreadcrumb
            category="Commercial"
            segments={[
              { label: "Quotes", href: "/dev/quotes" },
              {
                label: `Q-${dto.quote.quoteNumber}`,
                href: `/dev/quotes/${dto.quote.id}`,
              },
              { label: `v${dto.quoteVersion.versionNumber} scope` },
            ]}
          />
          <div className="mt-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-zinc-100">Quote scope</h1>
              <p className="mt-1 text-sm text-zinc-400">
                Line items and execution modes for this version
              </p>
            </div>
            {isLatest && (
              <span className="rounded bg-emerald-950/30 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-800/50">
                Latest version
              </span>
            )}
          </div>
          <div className="mt-4">
            <InternalQuickJump title="Continue testing" links={quickJumpLinks} />
          </div>
        </header>

        <section className="space-y-8">
          {itemsByGroup.length === 0 ? (
            <InternalSparseState
              message="No scoped work in this version yet"
              hint="Scope items are added to drafts via the commercial API or quote workspace."
              action={{ href: `/dev/quotes/${dto.quoteVersion.quoteId}`, label: "Open quote workspace" }}
            />
          ) : (
            itemsByGroup.map((group) => (
              <div key={group.id} className="space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    {group.name}
                  </h2>
                  <span className="text-[10px] text-zinc-500 uppercase font-medium">
                    {group.items.length} {group.items.length === 1 ? "Item" : "Items"}
                  </span>
                </div>

                <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/20">
                  <table className="w-full text-left text-xs text-zinc-300">
                    <thead className="bg-zinc-900/60 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                      <tr>
                        <th className="px-4 py-2">Line title</th>
                        <th className="px-4 py-2 text-right">Qty</th>
                        <th className="px-4 py-2 text-center">Execution</th>
                        <th className="px-4 py-2 text-center">Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y border-zinc-800">
                      {group.items.map((item) => (
                        <tr key={item.id} className="hover:bg-zinc-800/40 transition-colors">
                          <td className="px-4 py-2.5">
                            <p className="font-medium text-zinc-200">{item.title}</p>
                            {item.tierCode && (
                              <p className="text-[10px] text-zinc-500 mt-0.5">Tier: {item.tierCode}</p>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-zinc-400">
                            {item.quantity}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span className="text-[10px] text-zinc-500">{item.executionMode}</span>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span
                              className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                                item.scopePacketRevisionId
                                  ? "border border-sky-800/60 bg-sky-950/30 text-sky-400"
                                  : "border border-zinc-700/60 bg-zinc-800/30 text-zinc-400"
                              }`}
                            >
                              {item.scopePacketRevisionId ? "Library" : "Local"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </section>

        <section className="mt-12 space-y-4">
          <QuoteLocalPacketEditor
            quoteVersionId={quoteVersionId}
            isDraft={isDraft}
            canOfficeMutate={canOfficeMutate}
            initialPackets={localPackets}
            pinnedWorkflowVersionId={scopeModel.pinnedWorkflowVersionId ?? null}
          />
        </section>

        <footer className="mt-12 space-y-6">
          <details className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950/30 p-4">
            <summary className="cursor-pointer text-xs font-medium text-zinc-400 hover:text-zinc-300">
              Technical details
            </summary>
            <div className="mt-4 space-y-6">
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                  GET …/scope (JSON)
                </p>
                <pre className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-[11px] leading-relaxed text-zinc-400">
                  {JSON.stringify(dto, null, 2)}
                </pre>
              </div>
              {lifecycleDto && (
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                    GET …/lifecycle (JSON)
                  </p>
                  <pre className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-[11px] leading-relaxed text-zinc-400">
                    {JSON.stringify(lifecycleDto, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </details>
        </footer>
      </main>
    );
  } catch (e) {
    if (e instanceof PrismaClientInitializationError) {
      return (
        <main className="mx-auto max-w-2xl space-y-4 p-8">
          <p className="font-medium text-red-400">Database connection failed</p>
          <p className="text-sm text-zinc-400">{e.message}</p>
          <ul className="list-disc space-y-2 pl-5 text-sm text-zinc-500">
            <li>
              Put <code className="text-zinc-400">DATABASE_URL</code> in <code className="text-zinc-400">.env</code> or{" "}
              <code className="text-zinc-400">.env.local</code> (same folder as <code className="text-zinc-400">package.json</code>).
            </li>
            <li>Confirm Postgres is running and reachable from this machine.</li>
            <li>Restart <code className="text-zinc-400">npm run dev</code> after changing env files.</li>
          </ul>
          <Link href="/" className="inline-block text-sm text-sky-400">
            Home
          </Link>
        </main>
      );
    }
    if (e instanceof Error && e.message.startsWith("[Struxient] DATABASE_URL")) {
      return (
        <main className="mx-auto max-w-2xl space-y-4 p-8">
          <p className="font-medium text-amber-400">Missing DATABASE_URL</p>
          <p className="text-sm text-zinc-400">{e.message}</p>
          <Link href="/" className="inline-block text-sm text-sky-400">
            Home
          </Link>
        </main>
      );
    }
    if (e instanceof InvariantViolationError) {
      return (
        <main className="mx-auto max-w-2xl p-8">
          <p className="font-medium text-red-400">Invariant violation: {e.code}</p>
          <p className="mt-2 text-sm text-zinc-400">{e.message}</p>
          {e.context ? (
            <pre className="mt-4 overflow-x-auto rounded border border-zinc-800 bg-zinc-900 p-3 text-xs text-zinc-400">
              {JSON.stringify(e.context, null, 2)}
            </pre>
          ) : null}
        </main>
      );
    }
    throw e;
  }
}
