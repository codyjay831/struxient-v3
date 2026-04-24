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
  createCommercialQuoteShellInTransaction,
  precomputeCommercialQuoteShellInput,
  type CommercialQuoteShellDto,
  type CommercialQuoteShellTxInput,
  type CreateCommercialQuoteShellInput,
  type CreateCommercialQuoteShellResult,
  type CreateCommercialQuoteShellTxParams,
} from "./mutations/create-commercial-quote-shell";
export {
  convertLeadToQuoteShellForTenant,
  type ConvertLeadToQuoteShellFailKind,
  type ConvertLeadToQuoteShellInput,
  type ConvertLeadToQuoteShellResult,
} from "./mutations/convert-lead-to-quote-shell";
export {
  createLeadForTenant,
  setLeadStatusForTenant,
  updateLeadForTenant,
  type CreateLeadForTenantInput,
  type CreateLeadForTenantResult,
  type SetLeadStatusForTenantInput,
  type SetLeadStatusForTenantResult,
  type UpdateLeadForTenantInput,
  type UpdateLeadForTenantResult,
} from "./mutations/lead-mutations";
export {
  clampLeadListLimit,
  getLeadForTenant,
  listLeadsForTenant,
  type LeadDetailDto,
  type LeadSummaryDto,
} from "./reads/lead-reads";
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
  listCustomerDocumentsForTenant,
  type CustomerDocumentSummaryDto,
} from "./reads/customer-document-reads";
export {
  listCustomerAuditEventsForTenant,
  type CustomerAuditEventListItemDto,
} from "./reads/customer-audit-reads";
export {
  getTenantOperationalSettingsForTenant,
  type TenantOperationalSettingsDto,
} from "./reads/tenant-operational-settings-reads";
export { listTenantMembersForTenant, type TenantMemberSummaryDto } from "./reads/tenant-team-reads";
export {
  updateTenantMemberRoleForTenant,
  type UpdateTenantMemberRoleResult,
} from "./mutations/tenant-member-role-mutations";
export {
  updateTenantOperationalSettingsForTenant,
  type UpdateTenantOperationalSettingsInput,
  type UpdateTenantOperationalSettingsResult,
} from "./mutations/tenant-operational-settings-mutations";
export {
  archiveCustomerDocumentForTenant,
  createCustomerDocumentForTenant,
  type ArchiveCustomerDocumentResult,
  type CreateCustomerDocumentResult,
} from "./mutations/customer-document-mutations";
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
  declineQuoteVersionViaPortalShareToken,
  type DeclineQuoteVersionViaPortalRequestBody,
  type DeclineQuoteVersionViaPortalResult,
  type DeclineQuoteVersionViaPortalSuccessDto,
} from "./mutations/decline-quote-version-via-portal";
export {
  requestQuoteChangesViaPortalShareToken,
  type RequestQuoteChangesViaPortalRequestBody,
  type RequestQuoteChangesViaPortalResult,
  type RequestQuoteChangesViaPortalSuccessDto,
} from "./mutations/request-quote-changes-via-portal";
export {
  retryQuotePortalShareDeliveryForTenant,
  sendQuotePortalShareForTenant,
  type RetryQuotePortalShareDeliveryResult,
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
  getJobHandoffForTenant,
  parseAssignedUserIdsJson,
  type JobHandoffReadRow,
} from "./reads/job-handoff-reads";
export {
  acknowledgeJobHandoffForTenant,
  sendJobHandoffForTenant,
  upsertJobHandoffDraftForTenant,
  type AcknowledgeJobHandoffResult,
  type SendJobHandoffResult,
  type UpsertJobHandoffDraftResult,
} from "./mutations/job-handoff-mutations";
export {
  GLOBAL_WORK_FEED_SCHEMA_VERSION,
  classifyGlobalWorkFeedRuntimeLane,
  getGlobalWorkFeedReadModelForTenant,
  isPreJobTaskOpenInWorkFeedStatus,
  type GlobalWorkFeedPreJobTaskReadRow,
  type GlobalWorkFeedReadModel,
  type GlobalWorkFeedRuntimeLane,
  type GlobalWorkFeedRuntimeTaskReadRow,
  type GlobalWorkFeedSkeletonTaskReadRow,
} from "./reads/global-work-feed-reads";
export {
  OFFICE_SEARCH_DEFAULT_LIMIT_PER_SECTION,
  OFFICE_SEARCH_QUERY_MAX_LEN,
  OFFICE_SEARCH_QUERY_MIN_LEN,
  OFFICE_SEARCH_SECTION_ORDER,
  OFFICE_TENANT_SEARCH_READ_SCHEMA_VERSION,
  normalizeOfficeSearchQuery,
  searchOfficeTenantAnchors,
  type OfficeSearchHit,
  type OfficeSearchSection,
  type OfficeSearchSectionKind,
  type OfficeTenantSearchReadModel,
} from "./reads/office-tenant-search-reads";
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
  type ActiveHoldForActionabilityBridge,
  type PaymentGateForActionabilityBridge,
  type RuntimeTaskActionabilityBridgeContext,
  type SkeletonTaskActionabilityBridgeContext,
  type TaskActionability,
  type TaskActionabilityApiDto,
  type TaskCompleteBlockReason,
  type TaskStartBlockReason,
  type TaskStartBlockerDetail,
} from "./eligibility/task-actionability";
