import Link from "next/link";
import { redirect } from "next/navigation";
import { getPrisma } from "@/server/db/prisma";
import { getQuoteWorkspaceForTenant } from "@/server/slice1/reads/quote-workspace-reads";
import { getQuoteVersionScopeReadModel } from "@/server/slice1/reads/quote-version-scope";
import { listQuoteLocalPacketsForVersion } from "@/server/slice1/reads/quote-local-packet-reads";
import { toQuoteVersionScopeApiDto } from "@/lib/quote-version-scope-dto";
import { principalHasCapability, tryGetApiPrincipal } from "@/lib/auth/api-principal";
import {
  deriveScopeVersionContext,
  groupQuoteScopeLineItemsByProposalGroup,
} from "@/lib/quote-scope/quote-scope-grouping";
import { QuoteLocalPacketEditor } from "@/components/quote-scope/quote-local-packet-editor";
import { ScopeEditor } from "./scope-editor";

type PageProps = { params: Promise<{ quoteId: string }> };

export const dynamic = "force-dynamic";

/**
 * Office scope authoring surface: `(office)/quotes/[quoteId]/scope`.
 *
 * Responsibilities:
 *   1. Resolve the auth principal (tenant gate). Redirect to login on failure.
 *   2. Load the quote workspace to find the head version (the editable head =
 *      `versions[0]`, ordered by versionNumber desc).
 *   3. Load the scope read model for that head version and project to the
 *      stable API DTO that the line-item endpoints also speak.
 *   4. Compute version context (latest_draft / older_draft / frozen_*).
 *      DRAFT-on-head is the only state the editor accepts mutations against;
 *      anything else renders a frozen-head banner with a path back to the
 *      workspace (where `QuoteWorkspaceActions` clones a new draft via
 *      `POST /api/quotes/:quoteId/versions`).
 *   5. Compute proposal-group bucketing via the shared pure helper.
 *
 * Auth/tenant/capability gates remain enforced server-side both here (page
 * gate) and in every line-item API route (`office_mutate`).
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

  const scopeModel = await getQuoteVersionScopeReadModel(prisma, {
    tenantId: auth.principal.tenantId,
    quoteVersionId: head.id,
  });

  if (!scopeModel) {
    // Head version disappeared between reads, or tenant scope shifted. Send
    // the operator back to the workspace to re-resolve canon. We do not
    // fabricate empty scope.
    redirect(`/quotes/${quoteId}`);
  }

  const dto = toQuoteVersionScopeApiDto(scopeModel);
  const isLatest = ws.latestQuoteVersionId === head.id;
  const versionContext = deriveScopeVersionContext({
    status: dto.quoteVersion.status,
    isLatest,
    versionNumber: dto.quoteVersion.versionNumber,
  });

  const isEditableHead = versionContext.kind === "latest_draft";
  const canOfficeMutate = principalHasCapability(auth.principal, "office_mutate");

  const grouping = groupQuoteScopeLineItemsByProposalGroup(dto.proposalGroups, dto.orderedLineItems);

  // Quote-local packets are an authoring surface for the head DRAFT only.
  // Fetch only when this page would actually render the editor — frozen and
  // older drafts are inspected via `(office)/quotes/[id]/versions/[vId]/scope`,
  // which deliberately mounts no mutation controls. Skipping the read on the
  // non-editable branch avoids a tenant DB round-trip with no UI consumer.
  const localPackets = isEditableHead
    ? await listQuoteLocalPacketsForVersion(prisma, {
        tenantId: auth.principal.tenantId,
        quoteVersionId: head.id,
      })
    : [];

  return (
    <main className="p-8 max-w-5xl mx-auto text-zinc-200">
      <header className="mb-6 border-b border-zinc-800 pb-5">
        <ScopeBreadcrumb quoteId={quoteId} quoteNumber={ws.quote.quoteNumber} />
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-zinc-50">Scope editor</h1>
            <p className="mt-1 text-sm text-zinc-400 max-w-2xl">
              Author line items for {ws.customer.name} — {ws.flowGroup.name}. Edits apply only to
              the head draft and require an office session with{" "}
              <code className="text-zinc-500">office_mutate</code>.
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
        canMutate={canOfficeMutate && isEditableHead}
        editableReason={
          !canOfficeMutate
            ? "missing_capability"
            : !isEditableHead
              ? "not_editable_head"
              : "ok"
        }
      />

      {/*
        Quote-local packets (authoring surface). Mounted only on the editable
        head DRAFT — frozen / older versions are inspected on the read-only
        version-scope route which deliberately omits mutation controls.

        The editor is canon-safe:
          - Server-side `office_mutate` gates are enforced by every API route
            it calls (`/api/quote-versions/.../local-packets`,
            `/api/quote-local-packets/...`). The `canOfficeMutate` prop only
            controls UI affordances; it never weakens the backend gate.
          - The component renders its own locked-state banners when
            `isDraft = false` or `canOfficeMutate = false`. We still gate at
            the page level so we don't even fetch packets when not needed.
      */}
      {isEditableHead ? (
        <section className="mt-12 space-y-4">
          <QuoteLocalPacketEditor
            quoteVersionId={dto.quoteVersion.id}
            isDraft={true}
            canOfficeMutate={canOfficeMutate}
            initialPackets={localPackets}
            pinnedWorkflowVersionId={dto.quoteVersion.pinnedWorkflowVersionId}
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
