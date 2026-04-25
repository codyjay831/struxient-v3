import Link from "next/link";
import { getPrisma } from "@/server/db/prisma";
import { getQuoteWorkspaceForTenant } from "@/server/slice1/reads/quote-workspace-reads";
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
  type QuoteHeadReadinessInput 
} from "@/lib/workspace/derive-quote-head-workspace-readiness";
import { redirect } from "next/navigation";
import { deriveAppOrigin } from "@/lib/http/derive-app-origin";

// Shared components
import { QuoteWorkspaceActions } from "@/components/quotes/workspace/quote-workspace-actions";
import { QuoteWorkspaceShellSummary } from "@/components/quotes/workspace/quote-workspace-shell-summary";
import { QuoteWorkspaceLineItemSummary } from "@/components/quotes/workspace/quote-workspace-line-item-summary";
import { QuoteWorkspaceLineItemList } from "@/components/quotes/workspace/quote-workspace-line-item-list";
import { QuoteWorkspaceHeadReadiness } from "@/components/quotes/workspace/quote-workspace-head-readiness";
import { QuoteWorkspacePinWorkflow } from "@/components/quotes/workspace/quote-workspace-pin-workflow";
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

function toReadinessInput(row: any, lineItemCount: number): QuoteHeadReadinessInput {
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
  const readiness = deriveQuoteHeadWorkspaceReadiness(
    head ? toReadinessInput(head, headLineItemCount) : null,
  );
  const recommendedStep = readiness.kind === "head" ? readiness.recommendedStepIndex : null;

  const latestDraft = ws.versions.find((v) => v.status === "DRAFT") ?? null;
  const canOfficeMutate = principalHasCapability(auth.principal, "office_mutate");

  // Targets for pipeline steps
  const headDraftPinTarget = head?.status === "DRAFT" ? {
    quoteVersionId: head.id,
    versionNumber: head.versionNumber,
    pinnedWorkflowVersionId: head.pinnedWorkflowVersionId,
  } : null;

  const latestDraftWorkspaceTarget = head?.status === "DRAFT" ? {
    quoteVersionId: head.id,
    versionNumber: head.versionNumber,
    hasPinnedWorkflow: !!head.pinnedWorkflowVersionId,
  } : null;

  const sentSignTarget = deriveNewestSentSignTarget(ws.versions);
  const portalDeclinedSummary = deriveNewestPortalDeclinedSummary(ws.versions);
  const portalChangeRequestOnSent = derivePortalChangeRequestOnSentTarget(sentSignTarget, ws.versions);
  const signedActivateTarget = deriveNewestSignedWithoutActivationTarget(ws.versions);
  const executionEntryTarget = deriveNewestActivatedExecutionEntryTarget(ws.versions);

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
    <main className="p-8 max-w-5xl mx-auto">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <nav className="flex items-center gap-2 text-xs font-medium text-zinc-500 mb-2">
            <Link href="/quotes" className="hover:text-zinc-300 transition-colors">Quotes</Link>
            <span>/</span>
            <span className="text-zinc-400">{ws.quote.quoteNumber}</span>
          </nav>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-50">
            Quote Workspace
          </h1>
          <p className="mt-2 text-sm text-zinc-400 max-w-2xl">
            Commercial lifecycle for {ws.customer.name} — {ws.flowGroup.name}. 
            Follow the steps below to prepare, send, and activate this engagement.
          </p>
        </div>
        <div className="flex items-center gap-3">
           {head ? (
             <Link href={`/quotes/${quoteId}/versions/${head.id}/scope`} className="px-3 py-1.5 rounded border border-zinc-700 bg-zinc-900 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-all">
                Inspect Scope
             </Link>
           ) : null}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-10">
          <QuoteWorkspaceShellSummary quoteId={quoteId} shell={ws} head={head} />

          <section aria-labelledby="workflow-heading">
            <div className="mb-6 border-b border-zinc-800 pb-2">
              <h2 id="workflow-heading" className="text-lg font-semibold text-zinc-50">
                Commercial Pipeline
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                Line items / packets define the work. The process template defines the node/stage skeleton it runs through.
                Author scope first, then pin a template, then send.
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
                  title="Pin Process Template"
                  hint="Pick the published process template (node/stage skeleton) the work will run through. The template does not define the work — your line items do."
                  isRecommended={recommendedStep === 2}
                >
                  <QuoteWorkspacePinWorkflow pinTarget={headDraftPinTarget} canOfficeMutate={canOfficeMutate} />
                </QuoteWorkspacePipelineStep>
              </div>

              <div id="step-3">
                <QuoteWorkspacePipelineStep
                  step={3}
                  title="Prepare & Send Proposal"
                  hint="Compose line items / packets onto the pinned template's nodes, freeze the snapshot, and send."
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
                  hint="Instantiate runtime tasks from the frozen execution package onto the pinned template's nodes."
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

        <div className="space-y-8">
          <div className="sticky top-24 space-y-8">
            <QuoteWorkspaceHeadReadiness head={head} headLineItemCount={headLineItemCount} />

            <QuoteWorkspacePreJobTasks flowGroupName={ws.flowGroup.name} tasks={ws.preJobTasks} />

            <QuoteWorkspacePaymentGates quoteId={quoteId} gates={ws.paymentGates} canOfficeMutate={canOfficeMutate} />
            
            <QuoteWorkspaceChangeOrders quoteId={quoteId} jobId={ws.flowGroup.jobId} changeOrders={ws.changeOrders} canOfficeMutate={canOfficeMutate} />
            
            <QuoteWorkspaceEvidence evidence={ws.evidence} />

            <QuoteWorkspaceExecutionBridge data={executionBridgeData} />
            
            <QuoteWorkspaceVersionHistory quoteId={quoteId} versions={ws.versions} canOfficeMutate={canOfficeMutate} />

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-6">
               <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-4">Support & Metadata</h3>
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
