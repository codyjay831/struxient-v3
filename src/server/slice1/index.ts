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
  getQuotePortalPresentationByShareToken,
  type QuotePortalPlanRowDto,
  type QuotePortalPresentationReadModel,
} from "./reads/quote-portal-reads";
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
  buildQuoteVersionCompareToPrior,
  getQuoteVersionHistoryForTenant,
  mapQuoteVersionRowToHistoryItem,
  type QuoteVersionCompareToPriorDto,
  type QuoteVersionHistoryCompareSourceRow,
  type QuoteVersionHistoryItemDto,
  type QuoteVersionHistoryReadDto,
} from "./reads/quote-version-history-reads";
export {
  getQuoteWorkspaceForTenant,
  type QuoteWorkspaceDto,
  type QuoteWorkspacePreJobTaskDto,
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
  listCustomerContactsForTenant,
  type CustomerContactMethodDto,
  type CustomerContactSummaryDto,
} from "./reads/customer-contact-reads";
export {
  createCustomerContactForTenant,
  createCustomerContactMethodForTenant,
  deleteCustomerContactMethodForTenant,
  type CreateCustomerContactInput,
  type CreateCustomerContactMethodInput,
  type CustomerContactMethodMutationDto,
  type CustomerContactMutationDto,
  updateCustomerContactForTenant,
  updateCustomerContactMethodForTenant,
  type UpdateCustomerContactInput,
  type UpdateCustomerContactMethodInput,
} from "./mutations/customer-contact-mutations";
export { parseCustomerContactMethodType } from "./mutations/customer-contact-method-type";
export {
  listCustomerNotesForTenant,
  type CustomerNoteSummaryDto,
} from "./reads/customer-note-reads";
export {
  listCustomerRecentActivityForTenant,
  type CustomerRecentActivityItemDto,
  type CustomerRecentActivityKind,
} from "./reads/customer-recent-activity-reads";
export {
  createCustomerNoteForTenant,
  type CustomerNoteMutationDto,
  updateCustomerNoteForTenant,
  type UpdateCustomerNoteInput,
} from "./mutations/customer-note-mutations";
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
  clampWorkflowTemplateListLimit,
  getWorkflowTemplateDetailForTenant,
  getWorkflowTemplateForTenant,
  getWorkflowVersionOfficeDetailForTenant,
  listWorkflowTemplatesForTenant,
  type WorkflowTemplateDetailDto,
  type WorkflowTemplateSummaryDto,
  type WorkflowVersionListRowDto,
  type WorkflowVersionOfficeDetailDto,
} from "./reads/workflow-template-reads";
export {
  createWorkflowTemplateForTenant,
  type CreateWorkflowTemplateInput,
  type CreateWorkflowTemplateResultDto,
} from "./mutations/create-workflow-template";
export {
  createWorkflowVersionDraftForTenant,
  type CreateWorkflowVersionDraftInput,
  type CreateWorkflowVersionDraftResultDto,
} from "./mutations/create-workflow-version-draft";
export {
  forkWorkflowVersionDraftFromSourceForTenant,
  type ForkWorkflowVersionDraftFromSourceInput,
  type ForkWorkflowVersionDraftFromSourceResultDto,
} from "./mutations/fork-workflow-version-draft-from-source";
export {
  replaceWorkflowVersionDraftSnapshotForTenant,
  type ReplaceWorkflowVersionDraftSnapshotInput,
  type ReplaceWorkflowVersionDraftSnapshotResultDto,
} from "./mutations/replace-workflow-version-draft-snapshot";
export {
  publishWorkflowVersionForTenant,
  type PublishWorkflowVersionInput,
  type PublishWorkflowVersionResultDto,
} from "./mutations/publish-workflow-version";
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
  voidQuoteVersionForTenant,
  type VoidQuoteVersionRequestBody,
  type VoidQuoteVersionResult,
} from "./mutations/void-quote-version-for-tenant";
export {
  signQuoteVersionViaPortalShareToken,
  type SignQuoteVersionViaPortalRequestBody,
  type SignQuoteVersionViaPortalResult,
  type SignQuoteVersionViaPortalSuccessDto,
} from "./mutations/sign-quote-version-via-portal";
export {
  sendQuotePortalShareForTenant,
  type SendQuotePortalShareRequestBody,
  type SendQuotePortalShareResult,
} from "./mutations/quote-portal-share-delivery";
export {
  regenerateQuotePortalShareTokenForTenant,
  type RegenerateQuotePortalShareTokenResult,
} from "./mutations/regenerate-quote-portal-share-token";
export {
  listQuotePortalShareDeliveriesForTenant,
  type QuotePortalShareDeliveryListItemDto,
} from "./reads/quote-portal-share-reads";
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
