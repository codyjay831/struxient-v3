import type { WorkflowVersionStatus } from "@prisma/client";
import { validateWorkflowSnapshotForPublish } from "@/lib/workflow-version-snapshot";
import { InvariantViolationError } from "../errors";

export type AssertWorkflowVersionPublishPreconditionsParams = {
  workflowTemplateId: string;
  workflowVersionId: string;
  currentStatus: WorkflowVersionStatus;
  snapshotJson: unknown;
};

/**
 * Preflight for DRAFT → PUBLISHED on `WorkflowVersion` (Epic 23).
 * Tenant ownership is enforced by the orchestrating mutation (load-side filter).
 */
export function assertWorkflowVersionPublishPreconditions(params: AssertWorkflowVersionPublishPreconditionsParams): void {
  if (params.currentStatus !== "DRAFT") {
    throw new InvariantViolationError(
      "WORKFLOW_VERSION_PUBLISH_NOT_DRAFT",
      "WorkflowVersion can only be published from DRAFT.",
      {
        workflowTemplateId: params.workflowTemplateId,
        workflowVersionId: params.workflowVersionId,
        currentStatus: params.currentStatus,
      },
    );
  }

  const snapErr = validateWorkflowSnapshotForPublish(params.snapshotJson);
  if (snapErr != null) {
    throw new InvariantViolationError(
      "WORKFLOW_VERSION_SNAPSHOT_INVALID",
      snapErr.message,
      snapErr.details ?? { snapshot: snapErr.code },
    );
  }
}
