import type { PrismaClient } from "@prisma/client";
import { InvariantViolationError } from "../errors";

export type CreateWorkflowVersionDraftInput = {
  tenantId: string;
  workflowTemplateId: string;
};

export type CreateWorkflowVersionDraftResultDto = {
  id: string;
  workflowTemplateId: string;
  versionNumber: number;
  status: "DRAFT";
  publishedAt: null;
  snapshotJson: unknown;
};

const initialDraftSnapshot = { nodes: [] as unknown[] };

/**
 * Creates the next `WorkflowVersion` as **DRAFT** for a template.
 * At most one DRAFT per template (409 if a draft already exists).
 */
export async function createWorkflowVersionDraftForTenant(
  prisma: PrismaClient,
  input: CreateWorkflowVersionDraftInput,
): Promise<CreateWorkflowVersionDraftResultDto | "not_found"> {
  const template = await prisma.workflowTemplate.findFirst({
    where: { id: input.workflowTemplateId, tenantId: input.tenantId },
    select: { id: true },
  });
  if (!template) return "not_found";

  const existingDraft = await prisma.workflowVersion.findFirst({
    where: { workflowTemplateId: template.id, status: "DRAFT" },
    select: { id: true, versionNumber: true },
  });
  if (existingDraft) {
    throw new InvariantViolationError(
      "WORKFLOW_TEMPLATE_DRAFT_VERSION_EXISTS",
      "This workflow template already has a DRAFT version; publish it before creating another draft.",
      {
        workflowTemplateId: template.id,
        existingDraftVersionId: existingDraft.id,
        existingDraftVersionNumber: existingDraft.versionNumber,
      },
    );
  }

  const agg = await prisma.workflowVersion.aggregate({
    where: { workflowTemplateId: template.id },
    _max: { versionNumber: true },
  });
  const nextVersion = (agg._max.versionNumber ?? 0) + 1;

  const row = await prisma.workflowVersion.create({
    data: {
      workflowTemplateId: template.id,
      versionNumber: nextVersion,
      status: "DRAFT",
      publishedAt: null,
      snapshotJson: initialDraftSnapshot,
    },
    select: {
      id: true,
      workflowTemplateId: true,
      versionNumber: true,
      status: true,
      publishedAt: true,
      snapshotJson: true,
    },
  });

  if (row.status !== "DRAFT" || row.publishedAt != null) {
    throw new Error("createWorkflowVersionDraftForTenant: unexpected row shape after create.");
  }

  return {
    id: row.id,
    workflowTemplateId: row.workflowTemplateId,
    versionNumber: row.versionNumber,
    status: "DRAFT",
    publishedAt: null,
    snapshotJson: row.snapshotJson,
  };
}
