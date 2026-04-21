import Link from "next/link";
import { PrismaClientInitializationError } from "@prisma/client/runtime/library";
import { InternalBreadcrumb } from "@/components/internal/internal-breadcrumb";
import { InternalNotFoundState, InternalSparseState } from "@/components/internal/internal-state-feedback";
import { getPrisma } from "@/server/db/prisma";
import { getQuoteVersionScopeReadModel } from "@/server/slice1/reads/quote-version-scope";
import { getQuoteWorkspaceForTenant } from "@/server/slice1/reads/quote-workspace-reads";
import { getQuoteVersionLifecycleReadModel } from "@/server/slice1/reads/quote-version-lifecycle";
import { listQuoteLocalPacketsForVersion } from "@/server/slice1/reads/quote-local-packet-reads";
import { InvariantViolationError } from "@/server/slice1/errors";
import { principalHasCapability, tryGetApiPrincipal, type ApiPrincipal } from "@/lib/auth/api-principal";
import { toQuoteVersionScopeApiDto } from "@/lib/quote-version-scope-dto";
import { toQuoteVersionLifecycleApiDto } from "@/lib/quote-version-lifecycle-dto";
import { InternalQuickJump } from "@/components/internal/internal-quick-jump";
import { QuoteLocalPacketEditor } from "@/components/quote-scope/quote-local-packet-editor";
import {
  buildQuoteScopeQuickJumpLinks,
  deriveScopeVersionContext,
  groupQuoteScopeLineItemsByProposalGroup,
  presentAuthFailure,
  presentInternalLoadError,
  type InternalLoadErrorInput,
} from "./quote-scope-page-state";

type PageProps = { params: Promise<{ quoteVersionId: string }> };

export const dynamic = "force-dynamic";

/**
 * Internal dev surface for inspecting and editing quote scope at a specific
 * version. Page-level responsibilities:
 *
 *   1. Resolve the auth principal; render a structured failure panel
 *      (kind-aware) if that fails.
 *   2. Load scope + lifecycle + workspace + local packets inside a single
 *      try/catch and classify any error into `InternalLoadErrorInput` so DB
 *      outages, missing env vars, and invariant violations all land in
 *      `ScopeLoadErrorScreen` rather than Next's generic 500.
 *   3. Derive grouping / quick-jump / version-context via pure helpers in
 *      `./quote-scope-page-state.ts` (covered by unit tests).
 *
 * Auth/tenant/capability gates remain enforced server-side. The `AuthChip`
 * surfaces the already-resolved `principal.authSource` so operators can see
 * whether they are on a real session or the documented dev bypass — it does
 * not weaken the gate.
 */
export default async function DevQuoteScopePage({ params }: PageProps) {
  const { quoteVersionId } = await params;
  const auth = await tryGetApiPrincipal();

  if (!auth.ok) {
    return <AuthFailureScreen failure={auth.failure} />;
  }

  const prisma = getPrisma();

  let scopeModel: Awaited<ReturnType<typeof getQuoteVersionScopeReadModel>>;
  try {
    scopeModel = await getQuoteVersionScopeReadModel(prisma, {
      tenantId: auth.principal.tenantId,
      quoteVersionId,
    });
  } catch (e) {
    return <ScopeLoadErrorScreen error={classifyScopeLoadError(e)} />;
  }

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

  let lifecycleModel: Awaited<ReturnType<typeof getQuoteVersionLifecycleReadModel>>;
  let workspaceModel: Awaited<ReturnType<typeof getQuoteWorkspaceForTenant>>;
  let localPackets: Awaited<ReturnType<typeof listQuoteLocalPacketsForVersion>>;
  try {
    [lifecycleModel, workspaceModel, localPackets] = await Promise.all([
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
  } catch (e) {
    return <ScopeLoadErrorScreen error={classifyScopeLoadError(e)} />;
  }

  const isDraft = scopeModel.status === "DRAFT";
  const canOfficeMutate = principalHasCapability(auth.principal, "office_mutate");

  const dto = toQuoteVersionScopeApiDto(scopeModel);
  const lifecycleDto = lifecycleModel ? toQuoteVersionLifecycleApiDto(lifecycleModel) : null;
  const isLatest = workspaceModel?.latestQuoteVersionId === quoteVersionId;

  const versionContext = deriveScopeVersionContext({
    status: dto.quoteVersion.status,
    isLatest,
    versionNumber: dto.quoteVersion.versionNumber,
  });

  const quickJumpLinks = buildQuoteScopeQuickJumpLinks({
    quoteId: dto.quoteVersion.quoteId,
    lifecycle: lifecycleDto,
  });

  const grouping = groupQuoteScopeLineItemsByProposalGroup(dto.proposalGroups, dto.orderedLineItems);

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
        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-zinc-100">Quote scope</h1>
              <AuthChip principal={auth.principal} />
            </div>
            <p className="mt-1 text-sm text-zinc-400">
              Line items and execution modes for this version. Mutations apply only to the head
              draft and require an office session with{" "}
              <code className="text-zinc-500">office_mutate</code> capability — gates are enforced
              server-side.
            </p>
          </div>
          {isLatest ? (
            <span className="rounded bg-emerald-950/30 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-800/50">
              Latest version
            </span>
          ) : (
            <span className="rounded bg-amber-950/30 px-2 py-0.5 text-[10px] font-medium text-amber-300 border border-amber-800/50">
              Older version
            </span>
          )}
        </div>
        <div className="mt-4">
          <InternalQuickJump title="Continue testing" links={quickJumpLinks} />
        </div>
      </header>

      <VersionContextBanner context={versionContext} quoteId={dto.quote.id} />

      {grouping.orphanedItems.length > 0 ? (
        <OrphanedLineItemsWarning count={grouping.orphanedItems.length} />
      ) : null}

      <section className="space-y-8">
        {grouping.groupsWithItems.length === 0 ? (
          <InternalSparseState
            message="No scoped work in this version yet"
            hint="Scope items are added to drafts via the commercial API or quote workspace."
            action={{ href: `/dev/quotes/${dto.quote.id}`, label: "Open quote workspace" }}
          />
        ) : (
          grouping.groupsWithItems.map((group) => (
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
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-mono text-zinc-500">
              <span>quoteVersionId: {dto.quoteVersion.id}</span>
              <span>quoteId: {dto.quoteVersion.quoteId}</span>
              {dto.quoteVersion.pinnedWorkflowVersionId ? (
                <span>pinnedWorkflowVersionId: {dto.quoteVersion.pinnedWorkflowVersionId}</span>
              ) : (
                <span>pinnedWorkflowVersionId: (none)</span>
              )}
            </div>
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
}

/* ---------------- Inline screens (server-rendered) ---------------- */

function AuthChip({ principal }: { principal: ApiPrincipal }) {
  const isSession = principal.authSource === "session";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
        isSession
          ? "border border-emerald-700/60 bg-emerald-900/30 text-emerald-200"
          : "border border-amber-700/60 bg-amber-900/30 text-amber-200"
      }`}
      title={
        isSession
          ? "Authenticated via real NextAuth session."
          : "Authenticated via STRUXIENT_DEV_AUTH_BYPASS — non-production only."
      }
    >
      auth: {principal.authSource} · role: {principal.role.toLowerCase()}
    </span>
  );
}

function VersionContextBanner({
  context,
  quoteId,
}: {
  context: ReturnType<typeof deriveScopeVersionContext>;
  quoteId: string;
}) {
  const toneCls =
    context.tone === "emerald"
      ? "border-emerald-900/60 bg-emerald-950/20 text-emerald-200"
      : context.tone === "amber"
        ? "border-amber-900/60 bg-amber-950/20 text-amber-200"
        : "border-zinc-800 bg-zinc-950/40 text-zinc-300";
  return (
    <section className={`mb-6 rounded-lg border p-4 text-xs leading-relaxed ${toneCls}`}>
      <p className="font-semibold uppercase tracking-wide text-[11px] opacity-90">
        {context.title}
      </p>
      <p className="mt-1 opacity-90">{context.message}</p>
      {context.kind === "older_draft" || context.kind === "frozen_latest" ? (
        <p className="mt-2 text-[11px]">
          <Link
            href={`/dev/quotes/${quoteId}`}
            className="underline underline-offset-2 hover:opacity-80"
          >
            Open quote workspace →
          </Link>
        </p>
      ) : null}
    </section>
  );
}

function OrphanedLineItemsWarning({ count }: { count: number }) {
  return (
    <section className="mb-6 rounded-lg border border-red-900/60 bg-red-950/20 p-4 text-xs leading-relaxed text-red-200">
      <p className="text-[11px] font-semibold uppercase tracking-wide">
        Scope DTO inconsistency · {count} orphaned line item{count === 1 ? "" : "s"}
      </p>
      <p className="mt-1 opacity-90">
        {count === 1 ? "One line item references" : `${count} line items reference`} a proposal
        group not present in this version's <code>proposalGroups</code>. {count === 1 ? "It is" : "They are"}{" "}
        intentionally not rendered above so the inconsistency is visible. Open the raw{" "}
        <em>Technical details → GET …/scope (JSON)</em> below and report the affected ids; this
        should not happen for a healthy read model.
      </p>
    </section>
  );
}

function AuthFailureScreen({
  failure,
}: {
  failure: Parameters<typeof presentAuthFailure>[0];
}) {
  const p = presentAuthFailure(failure);
  const toneCls =
    p.tone === "amber"
      ? "border-amber-900/60 bg-amber-950/20 text-amber-200"
      : "border-red-900/60 bg-red-950/20 text-red-200";
  return (
    <main className="mx-auto max-w-2xl space-y-5 p-8 text-zinc-200">
      <header className="border-b border-zinc-800 pb-4">
        <InternalBreadcrumb
          category="Commercial"
          segments={[{ label: "Quotes", href: "/dev/quotes" }, { label: "Auth required" }]}
        />
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-zinc-50">Quote scope</h1>
      </header>
      <section className={`rounded-lg border p-5 shadow-sm ${toneCls}`}>
        <p className="text-[11px] font-semibold uppercase tracking-wide opacity-90">
          Auth failure · {p.failureKind}
        </p>
        <p className="mt-1 text-sm font-semibold">{p.title}</p>
        <p className="mt-1 text-xs leading-relaxed opacity-90">{p.message}</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-xs leading-relaxed opacity-90">
          {p.remediation.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </section>
      <div className="flex flex-wrap gap-3 text-xs">
        <Link
          href="/dev/login"
          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-zinc-200 hover:bg-zinc-800 transition-colors"
        >
          Sign in
        </Link>
        <Link
          href="/"
          className="rounded border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-zinc-500 hover:text-zinc-400 transition-colors"
        >
          ← Hub
        </Link>
      </div>
    </main>
  );
}

function ScopeLoadErrorScreen({ error }: { error: InternalLoadErrorInput }) {
  const p = presentInternalLoadError(error);
  const toneCls =
    p.tone === "amber"
      ? "border-amber-900/60 bg-amber-950/20 text-amber-200"
      : "border-red-900/60 bg-red-950/20 text-red-200";
  return (
    <main className="mx-auto max-w-2xl space-y-5 p-8 text-zinc-200">
      <header className="border-b border-zinc-800 pb-4">
        <InternalBreadcrumb
          category="Commercial"
          segments={[{ label: "Quotes", href: "/dev/quotes" }, { label: "Scope load error" }]}
        />
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-zinc-50">Quote scope</h1>
      </header>
      <section className={`rounded-lg border p-5 shadow-sm ${toneCls}`}>
        <p className="text-[11px] font-semibold uppercase tracking-wide opacity-90">
          Load failure · {p.errorKind}
          {p.code ? ` · ${p.code}` : ""}
        </p>
        <p className="mt-1 text-sm font-semibold">{p.title}</p>
        <p className="mt-1 text-xs leading-relaxed opacity-90">{p.message}</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-xs leading-relaxed opacity-90">
          {p.remediation.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
        {p.context !== undefined ? (
          <pre className="mt-3 overflow-auto rounded border border-current/30 bg-black/40 p-2 font-mono text-[10px] leading-snug">
            {JSON.stringify(p.context, null, 2)}
          </pre>
        ) : null}
      </section>
      <div className="flex flex-wrap gap-3 text-xs">
        <Link
          href="/dev/quotes"
          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-zinc-200 hover:bg-zinc-800 transition-colors"
        >
          ← All quotes
        </Link>
        <Link
          href="/"
          className="rounded border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-zinc-500 hover:text-zinc-400 transition-colors"
        >
          Hub
        </Link>
      </div>
    </main>
  );
}

/**
 * Page-side error → helper-input adapter. Mirrors the catch ladder used by
 * `/dev/quotes/[quoteId]/page.tsx` so behavior is consistent across
 * adjacent quote surfaces. Pure-helper presentation lives in
 * `./quote-scope-page-state.ts` (re-exported from the workspace helper).
 */
function classifyScopeLoadError(e: unknown): InternalLoadErrorInput {
  if (e instanceof PrismaClientInitializationError) {
    return { kind: "prisma_init", message: e.message };
  }
  if (e instanceof Error && e.message.startsWith("[Struxient] DATABASE_URL")) {
    return { kind: "missing_database_url", message: e.message };
  }
  if (e instanceof InvariantViolationError) {
    return e.context !== undefined
      ? { kind: "invariant", code: e.code, message: e.message, context: e.context }
      : { kind: "invariant", code: e.code, message: e.message };
  }
  if (e instanceof Error) {
    return { kind: "unknown", message: e.message };
  }
  return { kind: "unknown", message: "Unknown failure while loading quote scope." };
}
