import Link from "next/link";
import { getPrisma } from "@/server/db/prisma";
import { ensureDraftQuoteVersionPinnedToCanonicalForTenant } from "@/server/slice1/mutations/ensure-draft-quote-version-canonical-pin";
import { getQuoteWorkspaceForTenant } from "@/server/slice1/reads/quote-workspace-reads";
import { getQuoteVersionScopeReadModel } from "@/server/slice1/reads/quote-version-scope";
import { listQuoteLocalPacketsForVersion } from "@/server/slice1/reads/quote-local-packet-reads";
import { listScopePacketsForTenant } from "@/server/slice1/reads/scope-packet-catalog-reads";
import { loadLineItemExecutionPreviewsForTenant } from "@/server/slice1/reads/line-item-execution-preview-support";
import { SCOPE_PACKET_LIST_LIMIT_DEFAULTS } from "@/lib/scope-packet-catalog-summary";
import { derivePacketStageReadiness } from "@/lib/workspace/derive-packet-stage-readiness";
import {
  buildProposedExecutionFlow,
  type ProposedExecutionFlow,
} from "@/lib/quote-proposed-execution-flow";
import { principalHasCapability, tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { deriveNewestActivatedExecutionEntryTarget } from "@/lib/workspace/derive-workspace-execution-entry-target";
import { deriveNewestSignedWithoutActivationTarget } from "@/lib/workspace/derive-workspace-signed-activate-target";
import {
  deriveNewestPortalDeclinedSummary,
  deriveNewestSentSignTarget,
  derivePortalChangeRequestOnSentTarget,
} from "@/lib/workspace/derive-workspace-sent-sign-target";
import {
  deriveQuoteHeadWorkspaceReadiness,
  type QuoteHeadReadinessInput,
} from "@/lib/workspace/derive-quote-head-workspace-readiness";
import { buildQuoteWorkspaceNextActionView } from "@/lib/workspace/quote-workspace-next-action";
import { redirect } from "next/navigation";
import { deriveAppOrigin } from "@/lib/http/derive-app-origin";

// Shared components
import { QuoteWorkspaceActions } from "@/components/quotes/workspace/quote-workspace-actions";
import { QuoteWorkspaceShellSummary } from "@/components/quotes/workspace/quote-workspace-shell-summary";
import { QuoteWorkspaceNextActionCard } from "@/components/quotes/workspace/quote-workspace-next-action-card";
import { QuoteWorkspaceLineItemSummary } from "@/components/quotes/workspace/quote-workspace-line-item-summary";
import { QuoteWorkspaceLineItemList } from "@/components/quotes/workspace/quote-workspace-line-item-list";
import { QuoteWorkspaceHeadReadiness } from "@/components/quotes/workspace/quote-workspace-head-readiness";
import { QuoteWorkspaceProposedExecutionFlow } from "@/components/quotes/workspace/quote-workspace-proposed-execution-flow";
import { QuoteWorkspaceComposeSendPanel } from "@/components/quotes/workspace/quote-workspace-compose-send-panel";
import { QuoteWorkspaceSignSent } from "@/components/quotes/workspace/quote-workspace-sign-sent";
import { QuoteWorkspaceActivateSigned } from "@/components/quotes/workspace/quote-workspace-activate-signed";
import { QuoteWorkspaceExecutionBridge, type ExecutionBridgeData } from "@/components/quotes/workspace/quote-workspace-execution-bridge";
import { QuoteWorkspaceVersionHistory } from "@/components/quotes/workspace/quote-workspace-version-history";
import { QuoteWorkspacePipelineStep } from "@/components/quotes/workspace/quote-workspace-pipeline-step";
import { QuoteWorkspacePreJobTasks } from "@/components/quotes/workspace/quote-workspace-pre-job-tasks";
import { QuoteWorkspacePaymentGates } from "@/components/quotes/workspace/quote-workspace-payment-gates";
import { QuoteWorkspaceChangeOrders } from "@/components/quotes/workspace/quote-workspace-change-orders";
import { QuoteWorkspaceEvidence } from "@/components/quotes/workspace/quote-workspace-evidence";

type PageProps = { params: Promise<{ quoteId: string }> };

export const dynamic = "force-dynamic";

function toReadinessInput(
  row: any,
  lineItemCount: number,
  packetStageReadiness: QuoteHeadReadinessInput["packetStageReadiness"] = null,
): QuoteHeadReadinessInput {
  return {
    id: row.id,
    versionNumber: row.versionNumber,
    status: row.status,
    lineItemCount,
    hasPinnedWorkflow: row.hasPinnedWorkflow,
    hasFrozenArtifacts: row.hasFrozenArtifacts,
    hasActivation: row.hasActivation,
    proposalGroupCount: row.proposalGroupCount,
    sentAt: row.sentAt,
    signedAt: row.signedAt,
    packetStageReadiness,
  };
}

export default async function OfficeQuoteWorkspacePage({ params }: PageProps) {
  const { quoteId } = await params;
  const auth = await tryGetApiPrincipal();

  if (!auth.ok) {
    redirect("/login");
  }

  const ws = await getQuoteWorkspaceForTenant(getPrisma(), {
    tenantId: auth.principal.tenantId,
    quoteId,
  });

  if (!ws) {
    redirect("/quotes");
  }

  const appOrigin = await deriveAppOrigin();

  const head = ws.versions[0] ?? null;
  const headLineItemCount = head?.lineItemCount ?? ws.headLineItemSummary?.lineItemCount ?? 0;

  const prisma = getPrisma();
  let canonicalPinEnsureError: string | null = null;
  let headForReadiness = head;
  if (head?.status === "DRAFT") {
    const pin = await ensureDraftQuoteVersionPinnedToCanonicalForTenant(prisma, {
      tenantId: auth.principal.tenantId,
      quoteVersionId: head.id,
    });
    if (!pin.ok) {
      if (pin.kind === "ensure_canonical_failed") {
        canonicalPinEnsureError = pin.message;
      }
    } else {
      headForReadiness = {
        ...head,
        pinnedWorkflowVersionId: pin.pinnedWorkflowVersionId,
        hasPinnedWorkflow: !!pin.pinnedWorkflowVersionId,
      };
    }
  }

  // Packet/stage readiness signal (Triangle Mode visibility slice). Only
  // loaded when the head is the editable DRAFT and actually has line items
  // — those are the cases where pre-send authoring help is meaningful and
  // where the scope page already pays the same I/O cost. Frozen / signed
  // versions don't get the signal here; we deliberately leave the row off
  // their readiness rather than re-confirm what send already verified.
  //
  // Reuses the exact same loader the scope page uses
  // (`loadLineItemExecutionPreviewsForTenant`) so the workspace cannot
  // disagree with the editor about which lines need attention. We do NOT
  // duplicate compose logic — `derivePacketStageReadiness` only summarizes
  // the existing per-line `LineItemExecutionPreviewDto` shapes.
  const headIsEditableDraft = head?.status === "DRAFT";
  const shouldLoadPacketReadiness =
    headIsEditableDraft && head != null && headLineItemCount > 0;
  let packetStageReadiness: QuoteHeadReadinessInput["packetStageReadiness"] = null;
  let proposedExecutionFlow: ProposedExecutionFlow | null = null;
  if (shouldLoadPacketReadiness) {
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
      const lineInputs = scopeModel.orderedLineItems.map((line) => ({
        lineItemId: line.id,
        lineTitle: line.title ?? null,
        preview: support.previewsByLineItemId[line.id]!,
      }));
      const workflowSnapshotHasStageNodes =
        scopeModel.pinnedWorkflowVersionId != null && support.workflowNodeKeys.length > 0;
      const signal = derivePacketStageReadiness(
        lineInputs.map((l) => ({ lineItemId: l.lineItemId, preview: l.preview })),
        { workflowSnapshotHasStageNodes },
      );
      packetStageReadiness = { state: signal.state, note: signal.note };
      proposedExecutionFlow = buildProposedExecutionFlow(lineInputs, {
        workflowSnapshotHasStageNodes,
      });
    }
  }

  const canOfficeMutate = principalHasCapability(auth.principal, "office_mutate");

  const latestDraftWorkspaceTarget = headForReadiness?.status === "DRAFT" ? {
    quoteVersionId: headForReadiness.id,
    versionNumber: headForReadiness.versionNumber,
    hasPinnedWorkflow: !!headForReadiness.pinnedWorkflowVersionId,
  } : null;

  const sentSignTarget = deriveNewestSentSignTarget(ws.versions);
  const portalDeclinedSummary = deriveNewestPortalDeclinedSummary(ws.versions);
  const portalChangeRequestOnSent = derivePortalChangeRequestOnSentTarget(sentSignTarget, ws.versions);
  const signedActivateTarget = deriveNewestSignedWithoutActivationTarget(ws.versions);
  const executionEntryTarget = deriveNewestActivatedExecutionEntryTarget(ws.versions);

  const readiness = deriveQuoteHeadWorkspaceReadiness(
    headForReadiness ? toReadinessInput(headForReadiness, headLineItemCount, packetStageReadiness) : null,
  );
  const recommendedStep = readiness.kind === "head" ? readiness.recommendedStepIndex : null;
  const headRow = headForReadiness ?? head;
  const nextActionModel = buildQuoteWorkspaceNextActionView(readiness, quoteId, {
    sentPortalShareToken: sentSignTarget?.portalQuoteShareToken ?? null,
    headHasActivation: !!headRow?.hasActivation,
  });

  // Execution bridge data
  const executionBridgeData: ExecutionBridgeData = executionEntryTarget ? {
    kind: "linked",
    quoteId,
    quoteVersionId: executionEntryTarget.quoteVersionId,
    versionNumber: executionEntryTarget.versionNumber,
    flowId: null,
    jobId: ws.flowGroup.jobId,
    activationId: null,
    activatedAtIso: null,
    runtimeTaskCount: null,
  } : { kind: "none" };

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-zinc-800 pb-4">
        <div>
          <nav className="flex items-center gap-2 text-xs font-medium text-zinc-500 mb-1">
            <Link href="/quotes" className="hover:text-zinc-300 transition-colors">
              Quotes
            </Link>
            <span>/</span>
            <span className="text-zinc-400">{ws.quote.quoteNumber}</span>
          </nav>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-50">Quote workspace</h1>
        </div>
        <div className="flex items-center gap-2">
          {head ? (
            <Link
              href={`/quotes/${quoteId}/versions/${head.id}/scope`}
              className="rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-[11px] font-medium text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-all"
            >
              Inspect scope
            </Link>
          ) : null}
        </div>
      </header>

      <QuoteWorkspaceShellSummary
        quoteId={quoteId}
        shell={ws}
        head={headForReadiness ?? head}
        variant="compact"
      />

      {canonicalPinEnsureError ? (
        <div
          className="mb-4 rounded border border-red-900/50 bg-red-950/30 p-3 text-sm text-red-100"
          role="alert"
        >
          <p className="font-medium">Execution flow binding failed</p>
          <p className="mt-1 text-xs text-red-200/90">{canonicalPinEnsureError}</p>
        </div>
      ) : null}

      <QuoteWorkspaceNextActionCard model={nextActionModel} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
        <div className="lg:col-span-2 space-y-8">
          <section aria-labelledby="workflow-heading">
            <div className="mb-6 border-b border-zinc-800 pb-2">
              <h2 id="workflow-heading" className="text-lg font-semibold text-zinc-50">
                Commercial Pipeline
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                Line items and their task packets define the work. Author the scope, review the
                proposed execution flow, then send.
              </p>
            </div>

            <div className="space-y-8">
              <div id="step-1">
                <QuoteWorkspacePipelineStep
                  step={1}
                  title="Build the quote"
                  hint="Add the line items the customer is buying. Some lines just appear on the proposal; others create work for your crew after approval."
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

                    {/* Authoring lives on a dedicated office route. The
                        workspace stays the overview/control surface; this
                        button hands off to the scope editor for line-item
                        CRUD on the head draft. */}
                    <div className="flex flex-wrap items-center gap-3">
                      <Link
                        href={`/quotes/${quoteId}/scope`}
                        className="rounded bg-sky-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-600 transition-colors"
                      >
                        Edit line items →
                      </Link>
                      <span className="text-[11px] text-zinc-500">
                        Open the editor to write a custom line or insert one of your saved lines.
                      </span>
                    </div>

                    <QuoteWorkspaceActions quoteId={quoteId} canOfficeMutate={canOfficeMutate} />
                  </div>
                </QuoteWorkspacePipelineStep>
              </div>

              <div id="step-2">
                <QuoteWorkspacePipelineStep
                  step={2}
                  title="Review Proposed Execution Flow"
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
                  title="Send Proposal"
                  hint="Lock this draft and send the proposal to the customer."
                  isRecommended={recommendedStep === 3}
                >
                  <QuoteWorkspaceComposeSendPanel latestDraft={latestDraftWorkspaceTarget} canOfficeMutate={canOfficeMutate} />
                </QuoteWorkspacePipelineStep>
              </div>

              <div id="step-4">
                <QuoteWorkspacePipelineStep
                  step={4}
                  title="Record Signature"
                  hint="Capture customer approval to move this version to SIGNED."
                  isRecommended={recommendedStep === 4}
                >
                  <QuoteWorkspaceSignSent
                    signTarget={sentSignTarget}
                    portalDeclinedSummary={portalDeclinedSummary}
                    portalChangeRequestOnSent={portalChangeRequestOnSent}
                    canOfficeMutate={canOfficeMutate}
                    appOrigin={appOrigin}
                    quoteWorkspaceRevisionSectionHref={`/quotes/${quoteId}#revision-management`}
                  />
                </QuoteWorkspacePipelineStep>
              </div>

              <div id="step-5">
                <QuoteWorkspacePipelineStep
                  step={5}
                  title="Activate Execution"
                  hint="Create the job’s task list from the signed proposal."
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
        </div>

        <div className="space-y-5">
          <div className="sticky top-20 space-y-5">
            <QuoteWorkspaceHeadReadiness
              head={head}
              headLineItemCount={headLineItemCount}
              packetStageReadiness={packetStageReadiness}
              variant="rail"
            />

            <QuoteWorkspacePreJobTasks flowGroupName={ws.flowGroup.name} tasks={ws.preJobTasks} />

            <QuoteWorkspacePaymentGates quoteId={quoteId} gates={ws.paymentGates} canOfficeMutate={canOfficeMutate} />
            
            <QuoteWorkspaceChangeOrders quoteId={quoteId} jobId={ws.flowGroup.jobId} changeOrders={ws.changeOrders} canOfficeMutate={canOfficeMutate} />
            
            <QuoteWorkspaceEvidence evidence={ws.evidence} />

            <QuoteWorkspaceExecutionBridge data={executionBridgeData} />
            
            <QuoteWorkspaceVersionHistory quoteId={quoteId} versions={ws.versions} canOfficeMutate={canOfficeMutate} />

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-6">
               <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-4">Advanced & metadata</h3>
               <div className="space-y-3 text-xs">
                  <div className="flex justify-between">
                     <span className="text-zinc-500">Quote ID</span>
                     <span className="font-mono text-zinc-400">{quoteId}</span>
                  </div>
                  <div className="flex justify-between">
                     <span className="text-zinc-500">Tenant</span>
                     <span className="text-zinc-400">{auth.principal.tenantId}</span>
                  </div>
                  <div className="pt-4 flex flex-wrap gap-3">
                     <Link href={`/api/quotes/${quoteId}/workspace`} className="text-sky-500 hover:underline">Workspace JSON</Link>
                     <Link href={`/api/quotes/${quoteId}/versions`} className="text-sky-500 hover:underline">Versions JSON</Link>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
