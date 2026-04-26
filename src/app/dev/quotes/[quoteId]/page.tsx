import Link from "next/link";
import { PrismaClientInitializationError } from "@prisma/client/runtime/library";
import { getPrisma } from "@/server/db/prisma";
import { getQuoteWorkspaceForTenant } from "@/server/slice1/reads/quote-workspace-reads";
import { getQuoteVersionScopeReadModel } from "@/server/slice1/reads/quote-version-scope";
import { listQuoteLocalPacketsForVersion } from "@/server/slice1/reads/quote-local-packet-reads";
import { listScopePacketsForTenant } from "@/server/slice1/reads/scope-packet-catalog-reads";
import { loadLineItemExecutionPreviewsForTenant } from "@/server/slice1/reads/line-item-execution-preview-support";
import { SCOPE_PACKET_LIST_LIMIT_DEFAULTS } from "@/lib/scope-packet-catalog-summary";
import {
  buildProposedExecutionFlow,
  type ProposedExecutionFlow,
} from "@/lib/quote-proposed-execution-flow";
import {
  principalHasCapability,
  tryGetApiPrincipal,
  type ApiPrincipal,
} from "@/lib/auth/api-principal";
import { deriveNewestActivatedExecutionEntryTarget } from "@/lib/workspace/derive-workspace-execution-entry-target";
import { deriveNewestSignedWithoutActivationTarget } from "@/lib/workspace/derive-workspace-signed-activate-target";
import {
  deriveNewestPortalDeclinedSummary,
  deriveNewestSentSignTarget,
  derivePortalChangeRequestOnSentTarget,
} from "@/lib/workspace/derive-workspace-sent-sign-target";
import { deriveQuoteHeadWorkspaceReadiness } from "@/lib/workspace/derive-quote-head-workspace-readiness";
import { InvariantViolationError } from "@/server/slice1/errors";
import { InternalBreadcrumb } from "@/components/internal/internal-breadcrumb";
import { InternalNotFoundState } from "@/components/internal/internal-state-feedback";
import { QuoteWorkspaceActions } from "@/components/quotes/workspace/quote-workspace-actions";
import { QuoteWorkspaceShellSummary } from "@/components/quotes/workspace/quote-workspace-shell-summary";
import { QuoteWorkspaceLineItemSummary } from "@/components/quotes/workspace/quote-workspace-line-item-summary";
import { QuoteWorkspaceLineItemList } from "@/components/quotes/workspace/quote-workspace-line-item-list";
import { QuoteWorkspaceHeadReadiness } from "@/components/quotes/workspace/quote-workspace-head-readiness";
import { QuoteWorkspacePinWorkflow } from "@/components/quotes/workspace/quote-workspace-pin-workflow";
import { QuoteWorkspaceProposedExecutionFlow } from "@/components/quotes/workspace/quote-workspace-proposed-execution-flow";
import { QuoteWorkspaceComposeSendPanel } from "@/components/quotes/workspace/quote-workspace-compose-send-panel";
import { QuoteWorkspaceSignSent } from "@/components/quotes/workspace/quote-workspace-sign-sent";
import { QuoteWorkspaceActivateSigned } from "@/components/quotes/workspace/quote-workspace-activate-signed";
import { QuoteWorkspaceExecutionBridge } from "@/components/quotes/workspace/quote-workspace-execution-bridge";
import { QuoteWorkspaceVersionHistory } from "@/components/quotes/workspace/quote-workspace-version-history";
import { QuoteWorkspacePipelineStep } from "@/components/quotes/workspace/quote-workspace-pipeline-step";
import {
  deriveExecutionBridgeData,
  deriveHeadDraftPipelineTargets,
  presentAuthFailure,
  presentWorkspaceLoadError,
  toQuoteHeadReadinessInput,
  type WorkspaceLoadErrorInput,
} from "./quote-workspace-page-state";
import { deriveAppOrigin } from "@/lib/http/derive-app-origin";

type PageProps = { params: Promise<{ quoteId: string }> };

export const dynamic = "force-dynamic";

/**
 * Internal dev surface for the quote workspace.
 *
 * Page-level responsibilities are kept thin:
 *   1. Resolve the auth principal (and render a structured failure panel if
 *      that fails — distinct per failure kind so operators see why).
 *   2. Load the workspace read model inside a try/catch so DB outages and
 *      invariant violations surface as inline panels with remediation, not
 *      as Next's generic 500 page.
 *   3. Derive pipeline targets / readiness via pure helpers in
 *      `./quote-workspace-page-state.ts` (covered by unit tests).
 *
 * Auth, tenant scope, and the `office_mutate` capability gate remain
 * enforced server-side. The `AuthChip` only surfaces the already-resolved
 * `principal.authSource` so operators can see at a glance whether they are
 * on a real session or the documented dev bypass — it never weakens the
 * gate itself.
 */
export default async function DevQuoteWorkspacePage({ params }: PageProps) {
  const { quoteId } = await params;
  const auth = await tryGetApiPrincipal();

  if (!auth.ok) {
    return <AuthFailureScreen failure={auth.failure} />;
  }

  let ws: Awaited<ReturnType<typeof getQuoteWorkspaceForTenant>>;
  try {
    ws = await getQuoteWorkspaceForTenant(getPrisma(), {
      tenantId: auth.principal.tenantId,
      quoteId,
    });
  } catch (e) {
    return <WorkspaceLoadErrorScreen error={classifyWorkspaceLoadError(e)} />;
  }

  if (!ws) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8 text-zinc-200 sm:px-6 lg:px-8">
        <header className="mb-8 border-b border-zinc-800/80 pb-6">
          <InternalBreadcrumb
            category="Commercial"
            segments={[{ label: "Quotes", href: "/dev/quotes" }, { label: "Not found" }]}
          />
        </header>
        <InternalNotFoundState
          title="Quote not found"
          message="This quote is not visible to your tenant. It may belong to another tenant or no longer exist."
          backLink={{ href: "/dev/quotes", label: "← All quotes" }}
        />
      </main>
    );
  }

  const appOrigin = await deriveAppOrigin();

  const head = ws.versions[0] ?? null;
  const headLineItemCount = head?.lineItemCount ?? ws.headLineItemSummary?.lineItemCount ?? 0;
  const headIsEditableDraft = head?.status === "DRAFT";

  // Mirror the office page: load the proposed execution flow when the head
  // is an editable DRAFT with line items. Pure aggregation on top of the
  // existing per-line preview support — same loader the scope editor uses.
  let proposedExecutionFlow: ProposedExecutionFlow | null = null;
  if (headIsEditableDraft && head != null && headLineItemCount > 0) {
    const prisma = getPrisma();
    const scopeModel = await getQuoteVersionScopeReadModel(prisma, {
      tenantId: auth.principal.tenantId,
      quoteVersionId: head.id,
    });
    if (scopeModel) {
      const localPackets = await listQuoteLocalPacketsForVersion(prisma, {
        tenantId: auth.principal.tenantId,
        quoteVersionId: head.id,
      });
      const libraryPackets = await listScopePacketsForTenant(prisma, {
        tenantId: auth.principal.tenantId,
        limit: SCOPE_PACKET_LIST_LIMIT_DEFAULTS.max,
      });
      const support = await loadLineItemExecutionPreviewsForTenant(prisma, {
        tenantId: auth.principal.tenantId,
        pinnedWorkflowVersionId: scopeModel.pinnedWorkflowVersionId,
        lineItems: scopeModel.orderedLineItems.map((line) => ({
          id: line.id,
          executionMode: line.executionMode,
          scopePacketRevisionId: line.scopePacketRevisionId,
          quoteLocalPacketId: line.quoteLocalPacketId,
          scopeRevision: line.scopePacketRevision
            ? {
                id: line.scopePacketRevision.id,
                scopePacketId: line.scopePacketRevision.scopePacket.id,
              }
            : null,
        })),
        libraryPackets,
        localPackets,
      });
      proposedExecutionFlow = buildProposedExecutionFlow(
        scopeModel.orderedLineItems.map((line) => ({
          lineItemId: line.id,
          lineTitle: line.title ?? null,
          preview: support.previewsByLineItemId[line.id]!,
        })),
      );
    }
  }

  const readiness = deriveQuoteHeadWorkspaceReadiness(
    head ? toQuoteHeadReadinessInput(head, headLineItemCount) : null,
  );
  const recommendedStep = readiness.kind === "head" ? readiness.recommendedStepIndex : null;

  const canOfficeMutate = principalHasCapability(auth.principal, "office_mutate");

  const { pinTarget: headDraftPinTarget, workspaceTarget: latestDraftWorkspaceTarget } =
    deriveHeadDraftPipelineTargets(head);

  const sentSignTarget = deriveNewestSentSignTarget(ws.versions);
  const portalDeclinedSummary = deriveNewestPortalDeclinedSummary(ws.versions);
  const portalChangeRequestOnSent = derivePortalChangeRequestOnSentTarget(sentSignTarget, ws.versions);
  const signedActivateTarget = deriveNewestSignedWithoutActivationTarget(ws.versions);
  const executionEntryTarget = deriveNewestActivatedExecutionEntryTarget(ws.versions);

  const executionBridgeData = deriveExecutionBridgeData({
    executionEntryTarget,
    quoteId,
    jobId: ws.flowGroup.jobId,
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 text-zinc-200 sm:px-6 lg:px-8">
      <header className="mb-8 border-b border-zinc-800/80 pb-6">
        <div className="flex flex-wrap items-start justify-between gap-3 text-sky-400">
          <div>
            <InternalBreadcrumb
              category="Commercial"
              segments={[
                { label: "Quotes", href: "/dev/quotes" },
                { label: ws.quote.quoteNumber },
                { label: "Workspace" },
              ]}
            />
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">
                Quote workspace
              </h1>
              <AuthChip principal={auth.principal} />
            </div>
            <p className="mt-2 max-w-xl text-xs leading-relaxed text-zinc-500">
              Progress this quote through the commercial lifecycle from draft to execution.
              Readiness and suggested actions are based on the current head version.
              Mutations require an office session with{" "}
              <code className="text-zinc-400">office_mutate</code> capability — gates are enforced
              server-side.
            </p>
          </div>
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-400">
            ← Hub
          </Link>
        </div>
      </header>

      <QuoteWorkspaceShellSummary quoteId={quoteId} shell={ws} head={head} />

      <div className="mb-10">
        <QuoteWorkspaceHeadReadiness head={head} headLineItemCount={headLineItemCount} />
      </div>

      <section aria-labelledby="workflow-heading" className="mb-10">
        <div className="mb-6 border-b border-zinc-800 pb-2">
          <h2 id="workflow-heading" className="text-sm font-semibold text-zinc-200">
            Lifecycle stages
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-zinc-500">
            Line items and their task packets define the work. Author scope, review the proposed
            execution flow, then send. Some actions require an office session with{" "}
            <span className="font-mono text-zinc-400">office_mutate</span> capability.
          </p>
        </div>

        <div className="space-y-10">
          <div id="step-1">
            <QuoteWorkspacePipelineStep
              step={1}
              title="Review scope & line items"
              hint="Line items and their packets are the primary scope authoring object — they define the sold work."
              isRecommended={recommendedStep === 1}
            >
              <div id="line-items" className="space-y-6">
                <QuoteWorkspaceLineItemSummary
                  quoteId={quoteId}
                  versionNumber={head?.versionNumber ?? null}
                  summary={ws.headLineItemSummary}
                />

                <QuoteWorkspaceLineItemList
                  versionNumber={head?.versionNumber ?? null}
                  items={ws.headLineItems}
                />

                <QuoteWorkspaceActions quoteId={quoteId} canOfficeMutate={canOfficeMutate} />
              </div>
            </QuoteWorkspacePipelineStep>
          </div>

          <div id="step-2">
            <QuoteWorkspacePipelineStep
              step={2}
              title="Review proposed execution flow"
              hint="This plan is generated from the quoted line items and their task packets. Stages organize the work; task packets define the actual tasks, order, blockers, and proof requirements."
              isRecommended={recommendedStep === 2}
            >
              <QuoteWorkspaceProposedExecutionFlow
                flow={proposedExecutionFlow}
                isEditableDraft={headIsEditableDraft}
              />
            </QuoteWorkspacePipelineStep>
          </div>

          <div id="step-3">
            <QuoteWorkspacePipelineStep
              step={3}
              title="Send proposal"
              hint="Freeze the proposed execution snapshot and send it to the customer."
              isRecommended={recommendedStep === 3}
            >
              <QuoteWorkspaceComposeSendPanel latestDraft={latestDraftWorkspaceTarget} canOfficeMutate={canOfficeMutate} />
            </QuoteWorkspacePipelineStep>
          </div>

          <div id="step-4">
            <QuoteWorkspacePipelineStep
              step={4}
              title="Record signature"
              hint="Capture customer approval to move this version to SIGNED."
              isRecommended={recommendedStep === 4}
            >
              <QuoteWorkspaceSignSent
                signTarget={sentSignTarget}
                portalDeclinedSummary={portalDeclinedSummary}
                portalChangeRequestOnSent={portalChangeRequestOnSent}
                canOfficeMutate={canOfficeMutate}
                appOrigin={appOrigin}
                quoteWorkspaceRevisionSectionHref={`/dev/quotes/${quoteId}#revision-management`}
              />
            </QuoteWorkspacePipelineStep>
          </div>

          <div id="step-5">
            <QuoteWorkspacePipelineStep
              step={5}
              title="Activate execution"
              hint="Instantiate runtime tasks from the frozen execution package."
              isRecommended={recommendedStep === 5}
            >
              <QuoteWorkspaceActivateSigned
                activateTarget={signedActivateTarget}
                canOfficeMutate={canOfficeMutate}
              />
            </QuoteWorkspacePipelineStep>
          </div>
        </div>
      </section>

      <div className="mb-10" id="execution-bridge">
        <QuoteWorkspaceExecutionBridge data={executionBridgeData} />
      </div>

      <QuoteWorkspaceVersionHistory quoteId={quoteId} versions={ws.versions} canOfficeMutate={canOfficeMutate} />

      <details className="mt-10 rounded-lg border border-dashed border-zinc-800 bg-zinc-950/30 p-4 text-sm text-zinc-500">
        <summary className="cursor-pointer text-xs font-medium text-zinc-400 hover:text-zinc-300">
          Technical details
        </summary>
        <p className="mt-3 text-xs leading-relaxed">
          Raw JSON and route inspection for integrations. Prefer the structured sections above for day-to-day office
          work.
        </p>
        {/*
          Admin/technical escape hatch for the legacy "pin a process template"
          workflow. Office UX no longer surfaces this — the canonical workflow
          is auto-pinned at quote-version creation. This control is kept here
          for emergency overrides (e.g. internal migration to a different
          published workflow). The backend mutation still enforces tenant
          ownership, DRAFT status, and PUBLISHED workflow.
        */}
        <div className="mt-4 rounded border border-zinc-800/80 bg-zinc-950/40 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Manual workflow pin (admin override)
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
            New quotes auto-pin the canonical execution-stages workflow. Use this only when an
            internal migration requires pointing the head DRAFT at a different published workflow.
          </p>
          <div className="mt-3">
            <QuoteWorkspacePinWorkflow pinTarget={headDraftPinTarget} canOfficeMutate={canOfficeMutate} />
          </div>
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs">
          <li>
            <Link href={`/api/quotes/${quoteId}/workspace`} className="text-sky-500/90 hover:text-sky-400">
              Workspace JSON
            </Link>
          </li>
          <li>
            <Link href={`/api/quotes/${quoteId}/versions`} className="text-sky-500/90 hover:text-sky-400">
              Versions JSON
            </Link>
          </li>
          <li>
            <Link href={`/api/customers/${ws.customer.id}`} className="text-zinc-500 hover:text-zinc-400">
              Customer JSON
            </Link>
          </li>
          <li>
            <Link href={`/api/flow-groups/${ws.flowGroup.id}`} className="text-zinc-500 hover:text-zinc-400">
              Flow group JSON
            </Link>
          </li>
        </ul>
      </details>
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
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-zinc-50">Quote workspace</h1>
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

function WorkspaceLoadErrorScreen({ error }: { error: WorkspaceLoadErrorInput }) {
  const p = presentWorkspaceLoadError(error);
  const toneCls =
    p.tone === "amber"
      ? "border-amber-900/60 bg-amber-950/20 text-amber-200"
      : "border-red-900/60 bg-red-950/20 text-red-200";
  return (
    <main className="mx-auto max-w-2xl space-y-5 p-8 text-zinc-200">
      <header className="border-b border-zinc-800 pb-4">
        <InternalBreadcrumb
          category="Commercial"
          segments={[{ label: "Quotes", href: "/dev/quotes" }, { label: "Load error" }]}
        />
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-zinc-50">Quote workspace</h1>
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
 * `/dev/quote-scope/[quoteVersionId]/page.tsx` so behavior is consistent
 * across adjacent quote surfaces. Pure-helper presentation lives in
 * `./quote-workspace-page-state.ts`.
 */
function classifyWorkspaceLoadError(e: unknown): WorkspaceLoadErrorInput {
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
  return { kind: "unknown", message: "Unknown failure while loading quote workspace." };
}
