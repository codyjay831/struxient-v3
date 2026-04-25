import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { getPrisma } from "@/server/db/prisma";
import { getQuoteWorkspaceForTenant } from "@/server/slice1/reads/quote-workspace-reads";
import { getQuoteVersionScopeReadModel } from "@/server/slice1/reads/quote-version-scope";
import { toQuoteVersionScopeApiDto } from "@/lib/quote-version-scope-dto";
import {
  deriveScopeVersionContext,
  groupQuoteScopeLineItemsByProposalGroup,
  type ScopeVersionContext,
} from "@/lib/quote-scope/quote-scope-grouping";
import { formatExecutionModeLabel } from "@/lib/quote-line-item-execution-mode-label";

/**
 * Office-surface read-only scope inspector for a *specific* quote version.
 *
 * Canon-safe by reuse:
 *   - `getQuoteVersionScopeReadModel` is the same tenant-gated read the dev
 *     surface and the line-item API routes consume.
 *   - `toQuoteVersionScopeApiDto` is the canonical projection.
 *   - `groupQuoteScopeLineItemsByProposalGroup` and
 *     `deriveScopeVersionContext` are the same pure helpers the office head
 *     editor (`/quotes/[quoteId]/scope`) and the dev page already use.
 *
 * Routing contract:
 *   - For the head DRAFT version we redirect to the canonical authoring
 *     surface `/quotes/[quoteId]/scope`. There is exactly one place in the
 *     office app to *edit* head scope; this page never duplicates it.
 *   - Older drafts and frozen (SENT/SIGNED) versions render here, read-only.
 *   - URL-path drift (a `quoteVersionId` that belongs to a different
 *     `quoteId`) is treated as not-found, not a silent redirect — operators
 *     should never land on the wrong quote because of a bad link.
 *
 * Diagnostics intentionally omitted vs. `/dev/quote-scope/[quoteVersionId]`:
 * raw IDs in the body, `JSON.stringify(dto)` panels, `GET …/scope` and
 * `GET …/lifecycle` deep-links, the `Technical details` `<details>`,
 * `AuthChip`, the `/dev/*` quick-jump strip, and the `QuoteLocalPacketEditor`
 * (mutation surface — head-DRAFT only, lives on the head editor route).
 */
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ quoteId: string; quoteVersionId: string }>;
};

export default async function OfficeFrozenVersionScopePage({ params }: PageProps) {
  const { quoteId, quoteVersionId } = await params;

  const auth = await tryGetApiPrincipal();
  if (!auth.ok) {
    redirect("/login");
  }

  const prisma = getPrisma();

  const ws = await getQuoteWorkspaceForTenant(prisma, {
    tenantId: auth.principal.tenantId,
    quoteId,
  });

  if (!ws) {
    notFound();
  }

  const scopeModel = await getQuoteVersionScopeReadModel(prisma, {
    tenantId: auth.principal.tenantId,
    quoteVersionId,
  });

  if (!scopeModel) {
    notFound();
  }

  // Defensive integrity check: the version must belong to the quote in the
  // URL. The read model already tenant-gates, but a stray link that pairs
  // (quoteId=A, quoteVersionId=B-from-quote-C) would otherwise show the
  // wrong context chrome. Treat as not-found rather than silently rewriting.
  if (scopeModel.quoteId !== quoteId) {
    notFound();
  }

  const dto = toQuoteVersionScopeApiDto(scopeModel);
  const isLatest = ws.latestQuoteVersionId === quoteVersionId;
  const versionContext = deriveScopeVersionContext({
    status: dto.quoteVersion.status,
    isLatest,
    versionNumber: dto.quoteVersion.versionNumber,
  });

  // Single place to edit head DRAFT scope: the existing office editor. We
  // do not fork that surface; we just hand off to it.
  if (versionContext.kind === "latest_draft") {
    redirect(`/quotes/${quoteId}/scope`);
  }

  const grouping = groupQuoteScopeLineItemsByProposalGroup(
    dto.proposalGroups,
    dto.orderedLineItems,
  );

  return (
    <main className="p-8 max-w-5xl mx-auto text-zinc-200">
      <ScopeBreadcrumb
        quoteId={quoteId}
        quoteNumber={dto.quote.quoteNumber}
        versionNumber={dto.quoteVersion.versionNumber}
      />

      <header className="mt-3 mb-6 border-b border-zinc-800 pb-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-zinc-50">
                Line items · v{dto.quoteVersion.versionNumber}
              </h1>
              <VersionStateBadge context={versionContext} status={dto.quoteVersion.status} />
            </div>
            <p className="mt-1 text-sm text-zinc-400">
              Read-only snapshot of {dto.quote.customer.name} — {dto.quote.flowGroup.name}{" "}
              ({dto.quote.quoteNumber}).
            </p>
          </div>
          <Link
            href={`/quotes/${quoteId}`}
            className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
          >
            ← Back to workspace
          </Link>
        </div>
      </header>

      <VersionContextBanner context={versionContext} quoteId={quoteId} />

      {grouping.orphanedItems.length > 0 ? (
        <OrphanedLineItemsWarning count={grouping.orphanedItems.length} />
      ) : null}

      <section className="space-y-8">
        {grouping.groupsWithItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 p-10 text-center">
            <h2 className="text-zinc-200 font-medium">No line items in this version</h2>
            <p className="text-zinc-500 text-sm mt-1 max-w-md mx-auto">
              This version has no proposal groups with line items. If this is unexpected, check the
              workspace for the current draft.
            </p>
          </div>
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
                      <th className="px-4 py-2 text-center">Type</th>
                      <th className="px-4 py-2 text-center">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
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
                          <span className="text-[10px] text-zinc-500">
                            {formatExecutionModeLabel(item.executionMode)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <SourceBadge
                            kind={item.scopePacketRevisionId ? "library" : "local"}
                            label={
                              item.scopePacketRevisionId
                                ? "Saved work template"
                                : item.quoteLocalPacket
                                  ? "One-off work"
                                  : "—"
                            }
                          />
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
    </main>
  );
}

/* ---------------- Inline server-rendered chrome ---------------- */

function ScopeBreadcrumb({
  quoteId,
  quoteNumber,
  versionNumber,
}: {
  quoteId: string;
  quoteNumber: string;
  versionNumber: number;
}) {
  return (
    <nav className="flex items-center gap-2 text-xs font-medium text-zinc-500">
      <Link href="/quotes" className="hover:text-zinc-300 transition-colors">
        Quotes
      </Link>
      <span>/</span>
      <Link href={`/quotes/${quoteId}`} className="hover:text-zinc-300 transition-colors">
        {quoteNumber}
      </Link>
      <span>/</span>
      <span className="text-zinc-400">v{versionNumber} scope</span>
    </nav>
  );
}

function VersionStateBadge({
  context,
  status,
}: {
  context: ScopeVersionContext;
  status: string;
}) {
  const map: Record<
    ScopeVersionContext["kind"],
    { label: string; style: string }
  > = {
    latest_draft: {
      // Should never render here — the page redirects head DRAFT to the
      // editor — but keep the row defensively to avoid a TS exhaustiveness
      // bypass if canon evolves.
      label: "Head Draft",
      style: "text-emerald-300 bg-emerald-950/30 border-emerald-800/50",
    },
    older_draft: {
      label: `Older Draft · ${status}`,
      style: "text-amber-300 bg-amber-950/30 border-amber-800/50",
    },
    frozen_latest: {
      label: `Frozen Head · ${status}`,
      style: "text-amber-300 bg-amber-950/30 border-amber-800/50",
    },
    frozen_older: {
      label: `Historical · ${status}`,
      style: "text-zinc-300 bg-zinc-900/40 border-zinc-700/50",
    },
    unknown_status_latest: {
      label: `Head · ${status}`,
      style: "text-amber-300 bg-amber-950/30 border-amber-800/50",
    },
    unknown_status_older: {
      label: `Older · ${status}`,
      style: "text-amber-300 bg-amber-950/30 border-amber-800/50",
    },
  };
  const badge = map[context.kind];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${badge.style}`}
    >
      {badge.label}
    </span>
  );
}

function VersionContextBanner({
  context,
  quoteId,
}: {
  context: ScopeVersionContext;
  quoteId: string;
}) {
  const toneCls =
    context.tone === "emerald"
      ? "border-emerald-900/60 bg-emerald-950/20 text-emerald-200"
      : context.tone === "amber"
        ? "border-amber-900/60 bg-amber-950/20 text-amber-200"
        : "border-zinc-800 bg-zinc-950/40 text-zinc-300";
  const showWorkspaceLink =
    context.kind === "frozen_latest" ||
    context.kind === "older_draft" ||
    context.kind === "frozen_older" ||
    context.kind === "unknown_status_latest" ||
    context.kind === "unknown_status_older";
  return (
    <section className={`mb-6 rounded-lg border p-4 text-xs leading-relaxed ${toneCls}`}>
      <p className="font-semibold uppercase tracking-wide text-[11px] opacity-90">
        {context.title}
      </p>
      <p className="mt-1 opacity-90">{context.message}</p>
      {showWorkspaceLink ? (
        <p className="mt-2 text-[11px]">
          <Link
            href={`/quotes/${quoteId}`}
            className="underline underline-offset-2 hover:opacity-80"
          >
            Open quote workspace →
          </Link>{" "}
          (use “Create new draft version” to start an editable revision)
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
        group not present in this version. {count === 1 ? "It is" : "They are"} intentionally not
        rendered below so the inconsistency stays visible.
      </p>
    </section>
  );
}

function SourceBadge({
  kind,
  label,
}: {
  kind: "library" | "local";
  label: string;
}) {
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
        kind === "library"
          ? "border border-sky-800/60 bg-sky-950/30 text-sky-400"
          : "border border-zinc-700/60 bg-zinc-800/30 text-zinc-400"
      }`}
    >
      {label}
    </span>
  );
}
