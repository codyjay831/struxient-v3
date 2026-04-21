import Link from "next/link";
import { getPrisma } from "@/server/db/prisma";
import { getQuoteWorkspaceForTenant } from "@/server/slice1/reads/quote-workspace-reads";
import { principalHasCapability, tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { deriveNewestActivatedExecutionEntryTarget } from "@/lib/workspace/derive-workspace-execution-entry-target";
import { deriveNewestSignedWithoutActivationTarget } from "@/lib/workspace/derive-workspace-signed-activate-target";
import { deriveNewestSentSignTarget } from "@/lib/workspace/derive-workspace-sent-sign-target";
import { 
  deriveQuoteHeadWorkspaceReadiness, 
  type QuoteHeadReadinessInput 
} from "@/lib/workspace/derive-quote-head-workspace-readiness";
import { redirect } from "next/navigation";

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
import { QuoteWorkspacePaymentGates } from "@/components/quotes/workspace/quote-workspace-payment-gates";
import { QuoteWorkspaceChangeOrders } from "@/components/quotes/workspace/quote-workspace-change-orders";
import { QuoteWorkspaceEvidence } from "@/components/quotes/workspace/quote-workspace-evidence";

type PageProps = { params: Promise<{ quoteId: string }> };

export const dynamic = "force-dynamic";

function toReadinessInput(row: any): QuoteHeadReadinessInput {
  return {
    id: row.id,
    versionNumber: row.versionNumber,
    status: row.status,
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
    redirect("/dev/login");
  }

  const ws = await getQuoteWorkspaceForTenant(getPrisma(), {
    tenantId: auth.principal.tenantId,
    quoteId,
  });

  if (!ws) {
    redirect("/quotes");
  }

  const head = ws.versions[0] ?? null;
  const readiness = deriveQuoteHeadWorkspaceReadiness(head ? toReadinessInput(head) : null);
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
           <Link href={`/dev/quote-scope/${head?.id}`} className="px-3 py-1.5 rounded border border-zinc-700 bg-zinc-900 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-all">
              Inspect Scope
           </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-10">
          <QuoteWorkspaceShellSummary quoteId={quoteId} shell={ws} head={head} />

          <div id="line-items">
            <QuoteWorkspaceLineItemSummary
              versionNumber={head?.versionNumber ?? null}
              summary={ws.headLineItemSummary}
            />
          </div>

          <QuoteWorkspaceLineItemList
            versionNumber={head?.versionNumber ?? null}
            items={ws.headLineItems}
          />

          <section aria-labelledby="workflow-heading">
            <div className="mb-6 border-b border-zinc-800 pb-2">
              <h2 id="workflow-heading" className="text-lg font-semibold text-zinc-50">
                Commercial Pipeline
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                The standard operating procedure for moving a quote to execution.
              </p>
            </div>

            <div className="space-y-8">
              <QuoteWorkspacePipelineStep
                step={1}
                title="Review & Revise"
                hint="Modify scope line items and manage draft revisions."
                isRecommended={recommendedStep === 1}
              >
                <QuoteWorkspaceActions quoteId={quoteId} canOfficeMutate={canOfficeMutate} />
              </QuoteWorkspacePipelineStep>

              <QuoteWorkspacePipelineStep
                step={2}
                title="Select Workflow"
                hint="Attach a technical process skeleton to this quote."
                isRecommended={recommendedStep === 2}
              >
                <QuoteWorkspacePinWorkflow pinTarget={headDraftPinTarget} canOfficeMutate={canOfficeMutate} />
              </QuoteWorkspacePipelineStep>

              <QuoteWorkspacePipelineStep
                step={3}
                title="Prepare & Send"
                hint="Freeze the artifacts and send the proposal to the customer."
                isRecommended={recommendedStep === 3}
              >
                <QuoteWorkspaceComposeSendPanel latestDraft={latestDraftWorkspaceTarget} canOfficeMutate={canOfficeMutate} />
              </QuoteWorkspacePipelineStep>

              <QuoteWorkspacePipelineStep
                step={4}
                title="Record Signature"
                hint="Verify customer approval and prepare for activation."
                isRecommended={recommendedStep === 4}
              >
                <QuoteWorkspaceSignSent signTarget={sentSignTarget} canOfficeMutate={canOfficeMutate} />
              </QuoteWorkspacePipelineStep>

              <QuoteWorkspacePipelineStep
                step={5}
                title="Activate Execution"
                hint="Launch the runtime workflow and create execution records."
                isRecommended={recommendedStep === 5}
              >
                <QuoteWorkspaceActivateSigned
                  activateTarget={signedActivateTarget}
                  canOfficeMutate={canOfficeMutate}
                />
              </QuoteWorkspacePipelineStep>
            </div>
          </section>
        </div>

        <div className="space-y-8">
          <div className="sticky top-24 space-y-8">
            <QuoteWorkspaceHeadReadiness head={head} />
            
            <QuoteWorkspacePaymentGates quoteId={quoteId} gates={ws.paymentGates} canOfficeMutate={canOfficeMutate} />
            
            <QuoteWorkspaceChangeOrders quoteId={quoteId} jobId={ws.flowGroup.jobId} changeOrders={ws.changeOrders} canOfficeMutate={canOfficeMutate} />
            
            <QuoteWorkspaceEvidence evidence={ws.evidence} />

            <QuoteWorkspaceExecutionBridge data={executionBridgeData} />
            
            <QuoteWorkspaceVersionHistory versions={ws.versions} />

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
