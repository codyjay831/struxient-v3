import Link from "next/link";
import { redirect } from "next/navigation";
import { getPrisma } from "@/server/db/prisma";
import { ensureDraftQuoteVersionPinnedToCanonicalForTenant } from "@/server/slice1/mutations/ensure-draft-quote-version-canonical-pin";
import { getQuoteWorkspaceForTenant } from "@/server/slice1/reads/quote-workspace-reads";
import {
  buildLineItemTitlesByLocalPacketId,
  loadOfficeHeadScopeAuthoringModel,
} from "@/server/slice1/reads/load-office-head-scope-authoring-model";
import { principalHasCapability, tryGetApiPrincipal } from "@/lib/auth/api-principal";
import type { ScopeVersionContext } from "@/lib/quote-scope/quote-scope-grouping";
import { QuoteLocalPacketEditor } from "@/components/quote-scope/quote-local-packet-editor";
import { ScopeEditor } from "./scope-editor";

type PageProps = { params: Promise<{ quoteId: string }> };

export const dynamic = "force-dynamic";

/**
 * Office scope authoring surface: `(office)/quotes/[quoteId]/scope`.
 *
 * Data for {@link ScopeEditor} is loaded via {@link loadOfficeHeadScopeAuthoringModel}
 * (shared with the quote workspace embedded builder).
 */
export default async function OfficeQuoteScopePage({ params }: PageProps) {
  const { quoteId } = await params;
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
    redirect("/quotes");
  }

  const head = ws.versions[0] ?? null;

  if (!head) {
    return (
      <main className="p-8 max-w-5xl mx-auto text-zinc-200">
        <ScopeBreadcrumb quoteId={quoteId} quoteNumber={ws.quote.quoteNumber} />
        <h1 className="text-2xl font-semibold text-zinc-50">Scope</h1>
        <p className="mt-3 text-sm text-zinc-400">
          This quote has no versions yet, so there is nothing to author. Open the workspace to
          create the first draft version.
        </p>
        <div className="mt-4">
          <Link
            href={`/quotes/${quoteId}`}
            className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
          >
            Open workspace →
          </Link>
        </div>
      </main>
    );
  }

  let canonicalPinEnsureError: string | null = null;
  if (head.status === "DRAFT") {
    const pin = await ensureDraftQuoteVersionPinnedToCanonicalForTenant(prisma, {
      tenantId: auth.principal.tenantId,
      quoteVersionId: head.id,
    });
    if (!pin.ok && pin.kind === "ensure_canonical_failed") {
      canonicalPinEnsureError = pin.message;
    }
  }

  const authoring = await loadOfficeHeadScopeAuthoringModel(prisma, {
    tenantId: auth.principal.tenantId,
    quoteVersionId: head.id,
    latestQuoteVersionId: ws.latestQuoteVersionId,
  });

  if (!authoring) {
    redirect(`/quotes/${quoteId}`);
  }

  const { dto, grouping, versionContext, isEditableHead, localPackets, libraryPackets, presets, executionPreview } =
    authoring;

  const lineItemTitlesByLocalPacketId = buildLineItemTitlesByLocalPacketId(dto.orderedLineItems);
  const canOfficeMutate = principalHasCapability(auth.principal, "office_mutate");

  return (
    <main className="p-8 max-w-5xl mx-auto text-zinc-200">
      {canonicalPinEnsureError ? (
        <div
          className="mb-4 rounded border border-red-900/50 bg-red-950/30 p-3 text-sm text-red-100"
          role="alert"
        >
          <p className="font-medium">Execution flow binding failed</p>
          <p className="mt-1 text-xs text-red-200/90">{canonicalPinEnsureError}</p>
        </div>
      ) : null}
      <header className="mb-6 border-b border-zinc-800 pb-5">
        <ScopeBreadcrumb quoteId={quoteId} quoteNumber={ws.quote.quoteNumber} />
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-zinc-50">Line items</h1>
            <p className="mt-1 text-sm text-zinc-400 max-w-2xl">
              Add, edit, or remove the line items on this draft for {ws.customer.name} —{" "}
              {ws.flowGroup.name}.
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

      <ScopeEditor
        quoteId={quoteId}
        quoteVersionId={dto.quoteVersion.id}
        versionNumber={dto.quoteVersion.versionNumber}
        proposalGroups={dto.proposalGroups}
        groupedLineItems={grouping.groupsWithItems}
        availableLibraryPackets={libraryPackets}
        availableLocalPackets={localPackets}
        availablePresets={presets}
        executionPreviewByLineItemId={executionPreview?.previewsByLineItemId ?? null}
        fieldWorkAnchorsActive={isEditableHead}
        canMutate={canOfficeMutate && isEditableHead}
        editableReason={
          !canOfficeMutate
            ? "missing_capability"
            : !isEditableHead
              ? "not_editable_head"
              : "ok"
        }
      />

      {isEditableHead ? (
        <section className="mt-14 pt-10 border-t border-zinc-800/80 space-y-6">
          <QuoteLocalPacketEditor
            quoteVersionId={dto.quoteVersion.id}
            isDraft={true}
            canOfficeMutate={canOfficeMutate}
            initialPackets={localPackets}
            pinnedWorkflowVersionId={dto.quoteVersion.pinnedWorkflowVersionId}
            lineItemTitlesByLocalPacketId={lineItemTitlesByLocalPacketId}
            availableSavedPackets={libraryPackets.map((p) => ({
              id: p.id,
              packetKey: p.packetKey,
              displayName: p.displayName,
              hasDraftRevision: p.hasDraftRevision,
            }))}
          />
        </section>
      ) : null}
    </main>
  );
}

/* ---------------- Inline server-rendered chrome ---------------- */

function ScopeBreadcrumb({ quoteId, quoteNumber }: { quoteId: string; quoteNumber: string }) {
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
      <span className="text-zinc-400">Scope</span>
    </nav>
  );
}

function VersionContextBanner({ context, quoteId }: { context: ScopeVersionContext; quoteId: string }) {
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
