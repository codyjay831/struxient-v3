import Link from "next/link";
import { getPrisma } from "@/server/db/prisma";
import { ensureDraftQuoteVersionPinnedToCanonicalForTenant } from "@/server/slice1/mutations/ensure-draft-quote-version-canonical-pin";
import { getQuoteWorkspaceForTenant } from "@/server/slice1/reads/quote-workspace-reads";
import { getQuoteVersionScopeReadModel } from "@/server/slice1/reads/quote-version-scope";
import { listQuoteLocalPacketsForVersion } from "@/server/slice1/reads/quote-local-packet-reads";
import { listScopePacketsForTenant } from "@/server/slice1/reads/scope-packet-catalog-reads";
import { loadLineItemExecutionPreviewsForTenant } from "@/server/slice1/reads/line-item-execution-preview-support";
import { SCOPE_PACKET_LIST_LIMIT_DEFAULTS } from "@/lib/scope-packet-catalog-summary";
import { loadOfficeHeadScopeAuthoringModel } from "@/server/slice1/reads/load-office-head-scope-authoring-model";
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
import type { QuoteVersionHistoryItemDto } from "@/server/slice1/reads/quote-version-history-reads";

// Shared components
import { QuoteWorkspaceActions } from "@/components/quotes/workspace/quote-workspace-actions";
import { QuoteWorkspaceShellSummary } from "@/components/quotes/workspace/quote-workspace-shell-summary";
import { QuoteWorkspaceNextActionCard } from "@/components/quotes/workspace/quote-workspace-next-action-card";
import { QuoteWorkspaceLineItemSummary } from "@/components/quotes/workspace/quote-workspace-line-item-summary";
import { QuoteWorkspaceLineItemList } from "@/components/quotes/workspace/quote-workspace-line-item-list";
import { QuoteWorkspaceEmbeddedScopeEditor } from "@/components/quotes/workspace/quote-workspace-embedded-scope-editor";
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
  row: QuoteVersionHistoryItemDto,
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
  const canOfficeMutate = principalHasCapability(auth.principal, "office_mutate");

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

  const shouldAttemptEmbeddedScopeEditor =
    head != null &&
    head.status === "DRAFT" &&
    canOfficeMutate &&
    ws.latestQuoteVersionId === head.id;

  let officeAuthoring: Awaited<ReturnType<typeof loadOfficeHeadScopeAuthoringModel>> = null;
  if (shouldAttemptEmbeddedScopeEditor) {
    officeAuthoring = await loadOfficeHeadScopeAuthoringModel(prisma, {
      tenantId: auth.principal.tenantId,
      quoteVersionId: head.id,
      latestQuoteVersionId: ws.latestQuoteVersionId,
    });
    if (!officeAuthoring) {
      redirect(`/quotes/${quoteId}`);
    }
  }

  const embedScopeEditorInWorkspace =
    officeAuthoring != null && officeAuthoring.isEditableHead && canOfficeMutate;

  const headIsEditableDraft = head?.status === "DRAFT";
  const shouldLoadPacketReadinessFallback =
    headIsEditableDraft && head != null && headLineItemCount > 0 && !embedScopeEditorInWorkspace;

  let packetStageReadiness: QuoteHeadReadinessInput["packetStageReadiness"] = null;
  let proposedExecutionFlow: ProposedExecutionFlow | null = null;

  if (embedScopeEditorInWorkspace && officeAuthoring && headLineItemCount > 0 && officeAuthoring.executionPreview) {
    const dto = officeAuthoring.dto;
    const support = officeAuthoring.executionPreview;
    const lineInputs = dto.orderedLineItems.map((line) => ({
      lineItemId: line.id,
      lineTitle: line.title ?? null,
      preview: support.previewsByLineItemId[line.id]!,
    }));
    const workflowSnapshotHasStageNodes =
      dto.quoteVersion.pinnedWorkflowVersionId != null && support.workflowNodeKeys.length > 0;
    const signal = derivePacketStageReadiness(
      lineInputs.map((l) => ({ lineItemId: l.lineItemId, preview: l.preview })),
      { workflowSnapshotHasStageNodes },
    );
    packetStageReadiness = { state: signal.state, note: signal.note };
    proposedExecutionFlow = buildProposedExecutionFlow(lineInputs, {
      workflowSnapshotHasStageNodes,
    });
  } else if (shouldLoadPacketReadinessFallback) {
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

  // Job execution / activation entry target for links panel
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

  const headStatus = headRow?.status ?? "";
  const isDraftHead = headStatus === "DRAFT";
  const executionLinked = executionBridgeData.kind === "linked";
  const stepQuiet = (n: number) => recommendedStep != null && recommendedStep !== n;

  const scopeHref = `/quotes/${quoteId}/scope`;
  const headDisplay = headForReadiness ?? head;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <QuoteWorkspaceShellSummary
        quoteId={quoteId}
        shell={ws}
        head={headForReadiness ?? head}
        variant="compact"
      />

      {canonicalPinEnsureError ? (
        <div
          className="mb-4 rounded-md border border-red-900/50 bg-red-950/30 p-3 text-sm text-red-100"
          role="alert"
        >
          <p className="font-medium">Work plan binding failed</p>
          <p className="mt-1 text-xs text-red-200/90">{canonicalPinEnsureError}</p>
        </div>
      ) : null}

      {!embedScopeEditorInWorkspace ?
        <QuoteWorkspaceNextActionCard model={nextActionModel} variant="band" />
      : null}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
        <div className="space-y-8 lg:col-span-8">
          <section aria-labelledby="workflow-heading" className="space-y-6">
            <div className="border-b border-zinc-800/90 pb-4">
              <h2 id="workflow-heading" className="text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">
                Build quote
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-zinc-500">
                Line items and pricing below, then work plan, send, approval, and start work.
              </p>
            </div>

            <div className="space-y-10">
              <div id="step-1">
                <QuoteWorkspacePipelineStep
                  step={1}
                  title="Line items & pricing"
                  hint="Proposal-only lines stay on the quote; other lines can carry crew tasks after approval."
                  isRecommended={recommendedStep === 1}
                  isQuiet={stepQuiet(1)}
                  titleAside={
                    embedScopeEditorInWorkspace && officeAuthoring ?
                      <div className="flex flex-col items-end gap-0.5">
                        <Link
                          href={scopeHref}
                          className="inline-block w-fit max-w-full rounded-md border border-zinc-700/80 bg-zinc-900/60 px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
                        >
                          Line & tasks →
                        </Link>
                        <span className="max-w-[11rem] text-right text-[10px] leading-tight text-zinc-600">
                          Full-page task builder
                        </span>
                      </div>
                    : undefined
                  }
                >
                  <div id="line-items" className="space-y-5">
                    {embedScopeEditorInWorkspace && officeAuthoring ? (
                      <>
                        <p className="text-sm text-zinc-500">
                          Custom crew tasks for this quote only: use{" "}
                          <Link href={scopeHref} className="font-medium text-sky-400/90 hover:text-sky-300">
                            Line & tasks
                          </Link>
                          . Field-work links from a line open there when needed.
                        </p>

                        <div className="rounded-md border border-zinc-800/90 bg-zinc-950/40 p-3 ring-1 ring-zinc-800/60 sm:p-4">
                        <QuoteWorkspaceEmbeddedScopeEditor
                          quoteId={quoteId}
                          quoteVersionId={officeAuthoring.dto.quoteVersion.id}
                          versionNumber={officeAuthoring.dto.quoteVersion.versionNumber}
                          proposalGroups={officeAuthoring.dto.proposalGroups}
                          groupedLineItems={officeAuthoring.grouping.groupsWithItems}
                          availableLibraryPackets={officeAuthoring.libraryPackets}
                          availableLocalPackets={officeAuthoring.localPackets}
                          availablePresets={officeAuthoring.presets}
                          executionPreviewByLineItemId={
                            officeAuthoring.executionPreview?.previewsByLineItemId ?? null
                          }
                          fieldWorkAnchorsActive={officeAuthoring.isEditableHead}
                          fieldWorkExternalBaseHref={scopeHref}
                          canMutate={canOfficeMutate && officeAuthoring.isEditableHead}
                          editableReason={
                            !canOfficeMutate
                              ? "missing_capability"
                              : !officeAuthoring.isEditableHead
                                ? "not_editable_head"
                                : "ok"
                          }
                        />
                        </div>

                        <QuoteWorkspaceLineItemSummary
                          versionNumber={head?.versionNumber ?? null}
                          summary={ws.headLineItemSummary}
                        />
                      </>
                    ) : (
                      <>
                        <QuoteWorkspaceLineItemList
                          quoteId={quoteId}
                          versionNumber={head?.versionNumber ?? null}
                          items={ws.headLineItems}
                        />

                        <QuoteWorkspaceLineItemSummary
                          versionNumber={head?.versionNumber ?? null}
                          summary={ws.headLineItemSummary}
                        />

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                          <Link
                            href={scopeHref}
                            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 transition-colors"
                          >
                            Line & tasks →
                          </Link>
                          <span className="text-xs text-zinc-500">Edit lines, pricing, saved packets, and custom tasks.</span>
                        </div>
                      </>
                    )}

                    {!embedScopeEditorInWorkspace ?
                      <QuoteWorkspaceActions quoteId={quoteId} canOfficeMutate={canOfficeMutate} />
                    : null}
                  </div>
                </QuoteWorkspacePipelineStep>
              </div>

              <div id="step-2">
                <QuoteWorkspacePipelineStep
                  step={2}
                  title="Review work plan"
                  hint="Tasks by phase from your lines and packets. Fix issues in step 1 before send."
                  isRecommended={recommendedStep === 2}
                  isQuiet={stepQuiet(2)}
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
                  hint="Lock this draft and send to the customer."
                  isRecommended={recommendedStep === 3}
                  isQuiet={stepQuiet(3)}
                >
                  <QuoteWorkspaceComposeSendPanel latestDraft={latestDraftWorkspaceTarget} canOfficeMutate={canOfficeMutate} />
                </QuoteWorkspacePipelineStep>
              </div>

              <div id="step-4">
                <QuoteWorkspacePipelineStep
                  step={4}
                  title="Record customer approval"
                  hint="Portal or in-office steps to capture approval (SIGNED)."
                  isRecommended={recommendedStep === 4}
                  isQuiet={stepQuiet(4)}
                >
                  <QuoteWorkspaceSignSent
                    signTarget={sentSignTarget}
                    portalDeclinedSummary={portalDeclinedSummary}
                    portalChangeRequestOnSent={portalChangeRequestOnSent}
                    canOfficeMutate={canOfficeMutate}
                    appOrigin={appOrigin}
                    quoteWorkspaceRevisionSectionHref={`/quotes/${quoteId}#start-new-draft`}
                  />
                </QuoteWorkspacePipelineStep>
              </div>

              <div id="step-5">
                <QuoteWorkspacePipelineStep
                  step={5}
                  title="Start work"
                  hint="Create the job task list from the signed proposal when the crew is ready."
                  isRecommended={recommendedStep === 5}
                  isQuiet={stepQuiet(5)}
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

        <div className="space-y-4 lg:col-span-4">
          <div className="sticky top-20 space-y-4">
            {executionLinked ? (
              <QuoteWorkspaceExecutionBridge data={executionBridgeData} />
            ) : null}

            <QuoteWorkspaceHeadReadiness
              head={head}
              headLineItemCount={headLineItemCount}
              packetStageReadiness={packetStageReadiness}
              variant="rail"
              hideRecommendedPath={embedScopeEditorInWorkspace}
            />

            {isDraftHead ? (
              <details className="rounded-md border border-zinc-800/70 bg-zinc-950/25">
                <summary className="cursor-pointer px-3 py-2.5 text-sm font-medium text-zinc-400 hover:text-zinc-300">
                  Site & billing
                </summary>
                <div className="space-y-5 border-t border-zinc-800 px-3 pb-4 pt-4">
                  <QuoteWorkspacePreJobTasks flowGroupName={ws.flowGroup.name} tasks={ws.preJobTasks} />
                  <QuoteWorkspacePaymentGates quoteId={quoteId} gates={ws.paymentGates} canOfficeMutate={canOfficeMutate} />
                  <QuoteWorkspaceChangeOrders
                    quoteId={quoteId}
                    jobId={ws.flowGroup.jobId}
                    changeOrders={ws.changeOrders}
                    canOfficeMutate={canOfficeMutate}
                  />
                  <QuoteWorkspaceEvidence evidence={ws.evidence} />
                </div>
              </details>
            ) : (
              <>
                <QuoteWorkspacePreJobTasks flowGroupName={ws.flowGroup.name} tasks={ws.preJobTasks} />
                <QuoteWorkspacePaymentGates quoteId={quoteId} gates={ws.paymentGates} canOfficeMutate={canOfficeMutate} />
                <QuoteWorkspaceChangeOrders
                  quoteId={quoteId}
                  jobId={ws.flowGroup.jobId}
                  changeOrders={ws.changeOrders}
                  canOfficeMutate={canOfficeMutate}
                />
                <QuoteWorkspaceEvidence evidence={ws.evidence} />
              </>
            )}

            {!executionLinked ? (
              <details className="rounded-md border border-zinc-800/70 bg-zinc-950/25">
                <summary className="cursor-pointer px-3 py-2.5 text-sm font-medium text-zinc-400 hover:text-zinc-300">
                  After approval
                </summary>
                <div className="border-t border-zinc-800 px-3 pb-4 pt-4">
                  <QuoteWorkspaceExecutionBridge data={executionBridgeData} />
                </div>
              </details>
            ) : null}

            <details className="rounded-md border border-zinc-800/70 bg-zinc-950/25">
              <summary className="cursor-pointer px-3 py-2.5 text-sm font-medium text-zinc-400 hover:text-zinc-300">
                Quote versions
              </summary>
              <div className="border-t border-zinc-800 px-1 pb-2 pt-2">
                {embedScopeEditorInWorkspace ?
                  <div className="px-2 pb-2 pt-1">
                    <QuoteWorkspaceActions
                      quoteId={quoteId}
                      canOfficeMutate={canOfficeMutate}
                      variant="demoted"
                    />
                  </div>
                : null}
                <QuoteWorkspaceVersionHistory
                  quoteId={quoteId}
                  versions={ws.versions}
                  canOfficeMutate={canOfficeMutate}
                  showSectionHeader={false}
                />
              </div>
            </details>

            <details className="rounded-md border border-zinc-800/70 bg-zinc-950/25">
              <summary className="cursor-pointer px-3 py-2.5 text-sm font-medium text-zinc-500 hover:text-zinc-400">
                Support & IDs
              </summary>
              <div className="space-y-3 border-t border-zinc-800/80 px-3 py-3 text-xs text-zinc-500">
                <div className="flex justify-between gap-2">
                  <span>Quote number</span>
                  <span className="font-mono text-zinc-400">{ws.quote.quoteNumber}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>Quote ID</span>
                  <span className="font-mono text-zinc-400">{quoteId}</span>
                </div>
                {headDisplay ?
                  <div className="flex justify-between gap-2">
                    <span>Version ID</span>
                    <span className="max-w-[55%] truncate font-mono text-zinc-400">{headDisplay.id}</span>
                  </div>
                : null}
                <div className="flex justify-between gap-2">
                  <span>Tenant</span>
                  <span className="max-w-[55%] truncate text-zinc-400">{auth.principal.tenantId}</span>
                </div>
                <div className="flex flex-col gap-2 border-t border-zinc-800/60 pt-3">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-600">API</span>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    <Link
                      href={`/api/quotes/${quoteId}/workspace`}
                      className="text-sky-500/80 hover:text-sky-400 hover:underline"
                      prefetch={false}
                    >
                      Workspace
                    </Link>
                    <Link
                      href={`/api/quotes/${quoteId}/versions`}
                      className="text-sky-500/80 hover:text-sky-400 hover:underline"
                      prefetch={false}
                    >
                      Versions
                    </Link>
                    <Link
                      href={`/api/customers/${ws.customer.id}`}
                      className="text-sky-500/80 hover:text-sky-400 hover:underline"
                      prefetch={false}
                    >
                      Customer
                    </Link>
                    <Link
                      href={`/api/flow-groups/${ws.flowGroup.id}`}
                      className="text-sky-500/80 hover:text-sky-400 hover:underline"
                      prefetch={false}
                    >
                      Flow group
                    </Link>
                  </div>
                </div>
              </div>
            </details>
          </div>
        </div>
      </div>
    </main>
  );
}
