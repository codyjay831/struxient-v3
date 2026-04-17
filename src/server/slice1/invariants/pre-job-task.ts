import { InvariantViolationError } from "../errors";

/**
 * PreJobTask is FlowGroup-anchored; optional quote context must sit on the same site and tenant.
 *
 * @see docs/implementation/decision-packs/prejobtask-schema-decision-pack.md
 */
export function assertPreJobTaskAnchors(params: {
  taskTenantId: string;
  flowGroupId: string;
  flowGroupTenantId: string;
  quoteVersion?: {
    id: string;
    quote: { tenantId: string; flowGroupId: string };
  } | null;
  preJobTaskId?: string;
}): void {
  if (params.taskTenantId !== params.flowGroupTenantId) {
    throw new InvariantViolationError(
      "PREJOB_TENANT_FLOWGROUP_MISMATCH",
      "PreJobTask.tenantId must equal FlowGroup.tenantId",
      {
        preJobTaskId: params.preJobTaskId,
        taskTenantId: params.taskTenantId,
        flowGroupId: params.flowGroupId,
        flowGroupTenantId: params.flowGroupTenantId,
      },
    );
  }

  if (!params.quoteVersion) {
    return;
  }

  if (params.quoteVersion.quote.tenantId !== params.taskTenantId) {
    throw new InvariantViolationError(
      "PREJOB_QUOTE_VERSION_TENANT_MISMATCH",
      "PreJobTask linked QuoteVersion must belong to the same tenant as the task",
      {
        preJobTaskId: params.preJobTaskId,
        quoteVersionId: params.quoteVersion.id,
        taskTenantId: params.taskTenantId,
        quoteTenantId: params.quoteVersion.quote.tenantId,
      },
    );
  }

  if (params.quoteVersion.quote.flowGroupId !== params.flowGroupId) {
    throw new InvariantViolationError(
      "PREJOB_QUOTE_VERSION_FLOWGROUP_MISMATCH",
      "PreJobTask linked QuoteVersion must belong to the same FlowGroup as the task",
      {
        preJobTaskId: params.preJobTaskId,
        quoteVersionId: params.quoteVersion.id,
        flowGroupId: params.flowGroupId,
        quoteFlowGroupId: params.quoteVersion.quote.flowGroupId,
      },
    );
  }
}
