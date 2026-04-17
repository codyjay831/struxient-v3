import Link from "next/link";
import { getPrisma } from "@/server/db/prisma";
import { getQuoteWorkspaceForTenant } from "@/server/slice1/reads/quote-workspace-reads";
import { principalHasCapability, tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { deriveNewestActivatedExecutionEntryTarget } from "@/lib/workspace/derive-workspace-execution-entry-target";
import { deriveNewestSignedWithoutActivationTarget } from "@/lib/workspace/derive-workspace-signed-activate-target";
import { deriveNewestSentSignTarget } from "@/lib/workspace/derive-workspace-sent-sign-target";
import { getQuoteVersionLifecycleReadModel } from "@/server/slice1/reads/quote-version-lifecycle";
import { QuoteWorkspaceActions } from "./quote-workspace-actions";
import { QuoteWorkspaceComposeSendPanel } from "./quote-workspace-compose-send-panel";
import { QuoteWorkspaceHeadReadiness } from "./quote-workspace-head-readiness";
import { QuoteWorkspacePinWorkflow } from "./quote-workspace-pin-workflow";
import { QuoteWorkspaceActivateSigned } from "./quote-workspace-activate-signed";
import {
  QuoteWorkspaceExecutionBridge,
  type ExecutionBridgeData,
} from "./quote-workspace-execution-bridge";
import { QuoteWorkspaceSignSent } from "./quote-workspace-sign-sent";
import { QuoteWorkspaceShellSummary } from "./quote-workspace-shell-summary";
import { QuoteWorkspaceLineItemSummary } from "./quote-workspace-line-item-summary";
import { QuoteWorkspacePipelineStep } from "./quote-workspace-pipeline-step";
import { QuoteWorkspaceVersionHistory } from "./quote-workspace-version-history";

type PageProps = { params: Promise<{ quoteId: string }> };

export const dynamic = "force-dynamic";

/**
 * Quote workspace — office-oriented layout on top of the same read model as `GET /api/quotes/:quoteId/workspace`.
 */
export default async function DevQuoteWorkspacePage({ params }: PageProps) {
  const { quoteId } = await params;
  const auth = await tryGetApiPrincipal();

  if (!auth.ok) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <p className="text-zinc-300">
          Sign in at{" "}
          <Link href="/dev/login" className="text-sky-400">
            /dev/login
          </Link>
          .
        </p>
        <Link href="/dev/quotes" className="mt-4 inline-block text-sm text-sky-400">
          ← Quote list
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
      <main className="mx-auto max-w-3xl p-8">
        <p className="text-zinc-400">Quote not found for this tenant.</p>
        <Link href="/dev/quotes" className="mt-4 inline-block text-sm text-sky-400">
          ← Quote list
        </Link>
      </main>
    );
  }

  const canOfficeMutate = principalHasCapability(auth.principal, "office_mutate");
  const head = ws.versions[0] ?? null;
  const latestDraftWorkspaceTarget =
    head?.status === "DRAFT" ?
      {
        quoteVersionId: head.id,
        versionNumber: head.versionNumber,
        hasPinnedWorkflow: head.hasPinnedWorkflow,
      }
    : null;
  const headDraftPinTarget =
    head?.status === "DRAFT" ?
      {
        quoteVersionId: head.id,
        versionNumber: head.versionNumber,
        pinnedWorkflowVersionId: head.pinnedWorkflowVersionId,
      }
    : null;
  const sentSignTarget = deriveNewestSentSignTarget(ws.versions);
  const signedActivateTarget = deriveNewestSignedWithoutActivationTarget(
    ws.versions.map((v) => ({
      id: v.id,
      versionNumber: v.versionNumber,
      status: v.status,
      hasActivation: v.hasActivation,
      hasFrozenArtifacts: v.hasFrozenArtifacts,
    })),
  );

  const executionEntry = deriveNewestActivatedExecutionEntryTarget(
    ws.versions.map((v) => ({
      id: v.id,
      versionNumber: v.versionNumber,
      hasActivation: v.hasActivation,
    })),
  );

  let executionBridgeData: ExecutionBridgeData = { kind: "none" };
  if (executionEntry) {
    const lc = await getQuoteVersionLifecycleReadModel(getPrisma(), {
      tenantId: auth.principal.tenantId,
      quoteVersionId: executionEntry.quoteVersionId,
    });
    if (lc) {
      executionBridgeData = {
        kind: "linked",
        quoteVersionId: executionEntry.quoteVersionId,
        versionNumber: executionEntry.versionNumber,
        quoteId: ws.quote.id,
        flowId: lc.flow?.id ?? null,
        jobId: lc.job?.id ?? lc.flow?.jobId ?? null,
        activationId: lc.activation?.id ?? null,
        activatedAtIso: lc.activation?.activatedAt.toISOString() ?? null,
        runtimeTaskCount: lc.flow?.runtimeTaskCount ?? null,
      };
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 text-zinc-200 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-col gap-3 border-b border-zinc-800/80 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Commercial flow</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">Quote workspace</h1>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-zinc-500">
            Progress this quote through the commercial lifecycle from draft to execution.
            Readiness and suggested actions are based on the current head version.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link
            href="/dev/quotes"
            className="rounded-md border border-zinc-700 bg-zinc-900/60 px-3 py-1.5 text-zinc-200 hover:bg-zinc-800/80"
          >
            ← All quotes
          </Link>
          <Link href="/" className="rounded-md px-3 py-1.5 text-zinc-500 hover:text-zinc-300">
            Home
          </Link>
        </div>
      </header>

      <QuoteWorkspaceShellSummary quoteId={quoteId} shell={ws} head={head} />

      <div className="mb-8">
        <QuoteWorkspaceLineItemSummary
          versionNumber={head?.versionNumber ?? null}
          summary={ws.headLineItemSummary}
        />
      </div>

      <div className="mb-10">
        <QuoteWorkspaceHeadReadiness head={head} />
      </div>

      <section aria-labelledby="workflow-heading" className="mb-10">
        <div className="mb-6">
          <h2 id="workflow-heading" className="text-sm font-semibold text-zinc-200">
            Lifecycle stages
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-zinc-500">
            Follow the commercial steps to activate this quote. Some actions require an office session with{" "}
            <span className="font-mono text-zinc-400">office_mutate</span> capability.
          </p>
        </div>

        <div className="space-y-10">
          <QuoteWorkspacePipelineStep
            step={1}
            title="Review & revise"
            hint="Review current head version or create a new draft revision to make changes."
          >
            <QuoteWorkspaceActions quoteId={quoteId} canOfficeMutate={canOfficeMutate} />
          </QuoteWorkspacePipelineStep>

          <QuoteWorkspacePipelineStep
            step={2}
            title="Select workflow"
            hint="Attach a published workflow version to determine how the quote will be executed."
          >
            <QuoteWorkspacePinWorkflow pinTarget={headDraftPinTarget} canOfficeMutate={canOfficeMutate} />
          </QuoteWorkspacePipelineStep>

          <QuoteWorkspacePipelineStep
            step={3}
            title="Prepare & send proposal"
            hint="Run a preview to check for errors, then send the proposal to the customer."
          >
            <QuoteWorkspaceComposeSendPanel latestDraft={latestDraftWorkspaceTarget} canOfficeMutate={canOfficeMutate} />
          </QuoteWorkspacePipelineStep>

          <QuoteWorkspacePipelineStep
            step={4}
            title="Record signature"
            hint="Log the formal customer signature once the proposal has been sent."
          >
            <QuoteWorkspaceSignSent signTarget={sentSignTarget} canOfficeMutate={canOfficeMutate} />
          </QuoteWorkspacePipelineStep>

          <QuoteWorkspacePipelineStep
            step={5}
            title="Activate execution"
            hint="Launch the runtime workflow from the signed quote version."
          >
            <QuoteWorkspaceActivateSigned
              activateTarget={signedActivateTarget}
              canOfficeMutate={canOfficeMutate}
            />
          </QuoteWorkspacePipelineStep>
        </div>
      </section>

      <div className="mb-10">
        <QuoteWorkspaceExecutionBridge data={executionBridgeData} />
      </div>

      <QuoteWorkspaceVersionHistory versions={ws.versions} />

      <details className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950/30 p-4 text-sm text-zinc-500">
        <summary className="cursor-pointer text-xs font-medium text-zinc-400 hover:text-zinc-300">
          API & debug
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
