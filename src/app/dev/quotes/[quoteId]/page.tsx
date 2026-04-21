import Link from "next/link";
import { getPrisma } from "@/server/db/prisma";
import { getQuoteWorkspaceForTenant } from "@/server/slice1/reads/quote-workspace-reads";
import { principalHasCapability, tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { deriveNewestActivatedExecutionEntryTarget } from "@/lib/workspace/derive-workspace-execution-entry-target";
import { deriveNewestSignedWithoutActivationTarget } from "@/lib/workspace/derive-workspace-signed-activate-target";
import { deriveNewestSentSignTarget } from "@/lib/workspace/derive-workspace-sent-sign-target";
import { InternalBreadcrumb } from "@/components/internal/internal-breadcrumb";
import { InternalNotFoundState } from "@/components/internal/internal-state-feedback";
import { QuoteWorkspaceActions } from "@/components/quotes/workspace/quote-workspace-actions";
import { QuoteWorkspaceShellSummary } from "@/components/quotes/workspace/quote-workspace-shell-summary";
import { QuoteWorkspaceLineItemSummary } from "@/components/quotes/workspace/quote-workspace-line-item-summary";
import { QuoteWorkspaceLineItemList } from "@/components/quotes/workspace/quote-workspace-line-item-list";
import { QuoteWorkspaceHeadReadiness } from "@/components/quotes/workspace/quote-workspace-head-readiness";
import { QuoteWorkspacePinWorkflow } from "@/components/quotes/workspace/quote-workspace-pin-workflow";
import { QuoteWorkspaceComposeSendPanel } from "@/components/quotes/workspace/quote-workspace-compose-send-panel";
import { QuoteWorkspaceSignSent } from "@/components/quotes/workspace/quote-workspace-sign-sent";
import { QuoteWorkspaceActivateSigned } from "@/components/quotes/workspace/quote-workspace-activate-signed";
import { QuoteWorkspaceExecutionBridge } from "@/components/quotes/workspace/quote-workspace-execution-bridge";
import { QuoteWorkspaceVersionHistory } from "@/components/quotes/workspace/quote-workspace-version-history";
import { QuoteWorkspacePipelineStep } from "@/components/quotes/workspace/quote-workspace-pipeline-step";
import { ExecutionBridgeData } from "@/components/quotes/workspace/quote-workspace-execution-bridge";
import { 
  deriveQuoteHeadWorkspaceReadiness, 
  type QuoteHeadReadinessInput 
} from "@/lib/workspace/derive-quote-head-workspace-readiness";

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

export default async function DevQuoteWorkspacePage({ params }: PageProps) {
  const { quoteId } = await params;
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

  const ws = await getQuoteWorkspaceForTenant(getPrisma(), {
    tenantId: auth.principal.tenantId,
    quoteId,
  });

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
    flowId: null, // Minimal fix: UI handles null flowId/activatedAt
    jobId: ws.flowGroup.jobId,
    activationId: null,
    activatedAtIso: null,
    runtimeTaskCount: null,
  } : { kind: "none" };

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
            <h1 className="mt-2 text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">
              Quote workspace
            </h1>
            <p className="mt-2 max-w-xl text-xs leading-relaxed text-zinc-500">
              Progress this quote through the commercial lifecycle from draft to execution.
              Readiness and suggested actions are based on the current head version.
            </p>
          </div>
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-400">
            ← Hub
          </Link>
        </div>
      </header>

      <QuoteWorkspaceShellSummary quoteId={quoteId} shell={ws} head={head} />

      <div className="mb-8" id="line-items">
        <QuoteWorkspaceLineItemSummary
          versionNumber={head?.versionNumber ?? null}
          summary={ws.headLineItemSummary}
        />
      </div>

      <QuoteWorkspaceLineItemList
        versionNumber={head?.versionNumber ?? null}
        items={ws.headLineItems}
      />

      <div className="mb-10">
        <QuoteWorkspaceHeadReadiness head={head} />
      </div>

      <section aria-labelledby="workflow-heading" className="mb-10">
        <div className="mb-6 border-b border-zinc-800 pb-2">
          <h2 id="workflow-heading" className="text-sm font-semibold text-zinc-200">
            Lifecycle stages
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-zinc-500">
            Follow the commercial steps to activate this quote. Some actions require an office session with{" "}
            <span className="font-mono text-zinc-400">office_mutate</span> capability.
          </p>
        </div>

        <div className="space-y-10">
          <div id="step-1">
            <QuoteWorkspacePipelineStep
              step={1}
              title="Review & revise"
              hint="Create draft revisions and modify scope line items."
              isRecommended={recommendedStep === 1}
            >
              <QuoteWorkspaceActions quoteId={quoteId} canOfficeMutate={canOfficeMutate} />
            </QuoteWorkspacePipelineStep>
          </div>

          <div id="step-2">
            <QuoteWorkspacePipelineStep
              step={2}
              title="Select workflow"
              hint="Attach a workflow version to determine the execution structure."
              isRecommended={recommendedStep === 2}
            >
              <QuoteWorkspacePinWorkflow pinTarget={headDraftPinTarget} canOfficeMutate={canOfficeMutate} />
            </QuoteWorkspacePipelineStep>
          </div>

          <div id="step-3">
            <QuoteWorkspacePipelineStep
              step={3}
              title="Prepare & send proposal"
              hint="Freeze the version and send it for customer approval."
              isRecommended={recommendedStep === 3}
            >
              <QuoteWorkspaceComposeSendPanel latestDraft={latestDraftWorkspaceTarget} canOfficeMutate={canOfficeMutate} />
            </QuoteWorkspacePipelineStep>
          </div>

          <div id="step-4">
            <QuoteWorkspacePipelineStep
              step={4}
              title="Record signature"
              hint="Log approval to move the quote to SIGNED status."
              isRecommended={recommendedStep === 4}
            >
              <QuoteWorkspaceSignSent signTarget={sentSignTarget} canOfficeMutate={canOfficeMutate} />
            </QuoteWorkspacePipelineStep>
          </div>

          <div id="step-5">
            <QuoteWorkspacePipelineStep
              step={5}
              title="Activate execution"
              hint="Launch the runtime workflow and create execution records."
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

      <QuoteWorkspaceVersionHistory versions={ws.versions} />

      <details className="mt-10 rounded-lg border border-dashed border-zinc-800 bg-zinc-950/30 p-4 text-sm text-zinc-500">
        <summary className="cursor-pointer text-xs font-medium text-zinc-400 hover:text-zinc-300">
          Technical details
        </summary>
        <p className="mt-3 text-xs leading-relaxed">
          Raw JSON and route inspection for integrations. Prefer the structured sections above for day-to-day office
          work.
        </p>
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
