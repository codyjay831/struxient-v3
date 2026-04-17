/**
 * Slice 1 server boundary: quote scope reads + invariant assertions (pre-job, quote-local, line pins).
 */

export { getPrisma } from "../db/prisma";
export * from "./invariants";
export {
  assertQuoteVersionScopeViewInvariants,
  getQuoteVersionScopeReadModel,
  quoteVersionScopeQueryArgs,
  type QuoteVersionScopeDb,
  type QuoteVersionScopeLineOrdered,
  type QuoteVersionScopeReadModel,
  type QuoteVersionScopeView,
} from "./reads/quote-version-scope";
export { getQuoteVersionFreezeReadModel, type QuoteVersionFreezeReadModel } from "./reads/quote-version-freeze";
export {
  getQuoteVersionLifecycleReadModel,
  type QuoteVersionLifecycleReadModel,
} from "./reads/quote-version-lifecycle";
export { renameProposalGroupForTenant } from "./mutations/rename-proposal-group";
export {
  createCommercialQuoteShellForTenant,
  type CommercialQuoteShellDto,
  type CreateCommercialQuoteShellInput,
  type CreateCommercialQuoteShellResult,
} from "./mutations/create-commercial-quote-shell";
export {
  clampQuoteShellListLimit,
  getCommercialQuoteShellForTenant,
  listCommercialQuoteShellsForTenant,
  type CommercialQuoteShellLatestVersionDto,
  type CommercialQuoteShellSummaryDto,
} from "./reads/commercial-quote-shell-reads";
export {
  getQuoteVersionHistoryForTenant,
  mapQuoteVersionRowToHistoryItem,
  type QuoteVersionHistoryItemDto,
  type QuoteVersionHistoryReadDto,
} from "./reads/quote-version-history-reads";
export {
  getQuoteWorkspaceForTenant,
  type QuoteWorkspaceDto,
  type QuoteWorkspaceRouteHints,
} from "./reads/quote-workspace-reads";
export {
  createNextQuoteVersionForTenant,
  type CreateNextQuoteVersionResult,
  type CreateNextQuoteVersionSuccessDto,
} from "./mutations/create-next-quote-version";
export {
  clampCustomerListLimit,
  getCustomerForTenant,
  listCustomersForTenant,
  type CustomerSummaryDto,
} from "./reads/customer-reads";
export {
  clampFlowGroupListLimit,
  getFlowGroupForTenant,
  listFlowGroupsForTenant,
  type FlowGroupCustomerSummaryDto,
  type FlowGroupSummaryDto,
} from "./reads/flow-group-reads";
export {
  clampWorkflowVersionListLimit,
  getWorkflowVersionDiscoveryForTenant,
  listPublishedWorkflowVersionsForTenant,
  type WorkflowVersionDiscoveryItemDto,
} from "./reads/workflow-version-reads";
export {
  createQuoteLineItemForTenant,
  deleteQuoteLineItemForTenant,
  updateQuoteLineItemForTenant,
  type QuoteLineItemApiDto,
  type QuoteLineItemPatch,
} from "./mutations/quote-line-item-mutations";
export {
  buildComposePreviewResponse,
  type ComposePreviewRequestBody,
  type ComposePreviewResponseDto,
} from "./compose-preview/build-compose-preview";
export { sendQuoteVersionForTenant, type SendQuoteVersionRequestBody, type SendQuoteVersionSuccessDto } from "./mutations/send-quote-version";
export {
  setPinnedWorkflowVersionForTenant,
  type PinnedWorkflowQuoteVersionDto,
} from "./mutations/set-pinned-workflow-version";
export { signQuoteVersionForTenant, type SignQuoteVersionSuccessDto } from "./mutations/sign-quote-version";
export {
  activateQuoteVersionForTenant,
  activateQuoteVersionInTransaction,
  ensureActivationForSignedQuoteVersion,
  AutoActivateAfterSignError,
  type ActivateQuoteVersionSuccessDto,
} from "./mutations/activate-quote-version";
export { getJobShellReadModel, type JobShellReadModel } from "./reads/job-shell";
export {
  getFlowExecutionReadModel,
  type FlowExecutionReadModel,
  type FlowExecutionSkeletonTaskRead,
} from "./reads/flow-execution";
export {
  startRuntimeTaskForTenant,
  completeRuntimeTaskForTenant,
  type RuntimeTaskExecutionRequestBody,
  type TaskExecutionEventDto,
} from "./mutations/runtime-task-execution";
export {
  startSkeletonTaskForTenant,
  completeSkeletonTaskForTenant,
  type SkeletonTaskExecutionEventDto,
} from "./mutations/skeleton-task-execution";
export {
  TASK_ACTIONABILITY_SCHEMA_VERSION,
  evaluateRuntimeTaskActionability,
  evaluateSkeletonTaskActionability,
  toTaskActionabilityApiDto,
  type TaskActionability,
  type TaskActionabilityApiDto,
  type TaskStartBlockReason,
  type TaskCompleteBlockReason,
} from "./eligibility/task-actionability";
