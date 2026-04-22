import type { Prisma, PrismaClient } from "@prisma/client";
import { validateWorkflowSnapshotForDraftReplace } from "@/lib/workflow-version-snapshot";
import { InvariantViolationError } from "../errors";

export type ReplaceWorkflowVersionDraftSnapshotInput = {
  tenantId: string;
  workflowVersionId: string;
  snapshotJson: unknown;
};

export type ReplaceWorkflowVersionDraftSnapshotResultDto = {
  id: string;
  workflowTemplateId: string;
  versionNumber: number;
  status: "DRAFT";
  publishedAt: null;
  snapshotJson: unknown;
};

/**
 * Whole-snapshot replace for a **DRAFT** workflow version only (`office_mutate`).
 */
export async function replaceWorkflowVersionDraftSnapshotForTenant(
  prisma: PrismaClient,
  input: ReplaceWorkflowVersionDraftSnapshotInput,
): Promise<ReplaceWorkflowVersionDraftSnapshotResultDto | "not_found"> {
  const row = await prisma.workflowVersion.findFirst({
    where: {
      id: input.workflowVersionId,
      workflowTemplate: { tenantId: input.tenantId },
    },
    select: {
      id: true,
      workflowTemplateId: true,
      versionNumber: true,
      status: true,
      publishedAt: true,
    },
  });
  if (!row) return "not_found";

  if (row.status !== "DRAFT") {
    throw new InvariantViolationError(
      "WORKFLOW_VERSION_SNAPSHOT_REPLACE_NOT_DRAFT",
      "Only a DRAFT workflow version snapshot can be replaced.",
      { workflowVersionId: row.id, currentStatus: row.status },
    );
  }

  const shapeErr = validateWorkflowSnapshotForDraftReplace(input.snapshotJson);
  if (shapeErr != null) {
    throw new InvariantViolationError(
      "WORKFLOW_VERSION_SNAPSHOT_INVALID",
      shapeErr.message,
      shapeErr.details ?? {},
    );
  }

  const updated = await prisma.workflowVersion.update({
    where: { id: row.id },
    data: { snapshotJson: input.snapshotJson as Prisma.InputJsonValue },
    select: {
      id: true,
      workflowTemplateId: true,
      versionNumber: true,
      status: true,
      publishedAt: true,
      snapshotJson: true,
    },
  });

  return {
    id: updated.id,
    workflowTemplateId: updated.workflowTemplateId,
    versionNumber: updated.versionNumber,
    status: "DRAFT",
    publishedAt: null,
    snapshotJson: updated.snapshotJson,
  };
}
