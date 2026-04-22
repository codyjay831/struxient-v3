import type { Prisma, PrismaClient, WorkflowVersionStatus } from "@prisma/client";
import { InvariantViolationError } from "../errors";

export type ForkWorkflowVersionDraftFromSourceInput = {
  tenantId: string;
  workflowTemplateId: string;
  /** Published or superseded version to copy `snapshotJson` from; must belong to `workflowTemplateId`. */
  sourceWorkflowVersionId: string;
};

export type ForkWorkflowVersionDraftFromSourceResultDto = {
  id: string;
  workflowTemplateId: string;
  versionNumber: number;
  status: "DRAFT";
  publishedAt: null;
  snapshotJson: unknown;
  forkedFromWorkflowVersionId: string;
};

function cloneSnapshotJson(snapshotJson: unknown): unknown {
  return JSON.parse(JSON.stringify(snapshotJson)) as unknown;
}

function isForkableSourceStatus(status: WorkflowVersionStatus, publishedAt: Date | null): boolean {
  if (publishedAt == null) return false;
  return status === "PUBLISHED" || status === "SUPERSEDED";
}

/**
 * Creates the next **DRAFT** `WorkflowVersion` for a template by deep-cloning `snapshotJson`
 * from an existing **PUBLISHED** or **SUPERSEDED** row (must have `publishedAt`).
 * At most one DRAFT per template. Does not modify the source row.
 */
export async function forkWorkflowVersionDraftFromSourceForTenant(
  prisma: PrismaClient,
  input: ForkWorkflowVersionDraftFromSourceInput,
): Promise<ForkWorkflowVersionDraftFromSourceResultDto | "not_found"> {
  const template = await prisma.workflowTemplate.findFirst({
    where: { id: input.workflowTemplateId, tenantId: input.tenantId },
    select: { id: true },
  });
  if (!template) return "not_found";

  const source = await prisma.workflowVersion.findFirst({
    where: {
      id: input.sourceWorkflowVersionId,
      workflowTemplateId: template.id,
      workflowTemplate: { tenantId: input.tenantId },
    },
    select: {
      id: true,
      workflowTemplateId: true,
      status: true,
      publishedAt: true,
      snapshotJson: true,
    },
  });
  if (!source) return "not_found";

  if (!isForkableSourceStatus(source.status, source.publishedAt)) {
    throw new InvariantViolationError(
      "WORKFLOW_VERSION_FORK_SOURCE_INVALID",
      "Fork source must be PUBLISHED or SUPERSEDED with a publish timestamp (immutable lineage copy).",
      {
        workflowTemplateId: template.id,
        sourceWorkflowVersionId: source.id,
        currentStatus: source.status,
        hasPublishedAt: source.publishedAt != null,
      },
    );
  }

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

  const snapshotCopy = cloneSnapshotJson(source.snapshotJson);

  const row = await prisma.workflowVersion.create({
    data: {
      workflowTemplateId: template.id,
      versionNumber: nextVersion,
      status: "DRAFT",
      publishedAt: null,
      snapshotJson: snapshotCopy as Prisma.InputJsonValue,
      forkedFromWorkflowVersionId: source.id,
    },
    select: {
      id: true,
      workflowTemplateId: true,
      versionNumber: true,
      status: true,
      publishedAt: true,
      snapshotJson: true,
      forkedFromWorkflowVersionId: true,
    },
  });

  if (row.status !== "DRAFT" || row.publishedAt != null) {
    throw new Error("forkWorkflowVersionDraftFromSourceForTenant: unexpected row shape after create.");
  }
  if (row.forkedFromWorkflowVersionId == null || row.forkedFromWorkflowVersionId !== source.id) {
    throw new Error("forkWorkflowVersionDraftFromSourceForTenant: fork provenance not persisted on create.");
  }

  return {
    id: row.id,
    workflowTemplateId: row.workflowTemplateId,
    versionNumber: row.versionNumber,
    status: "DRAFT",
    publishedAt: null,
    snapshotJson: row.snapshotJson,
    forkedFromWorkflowVersionId: row.forkedFromWorkflowVersionId,
  };
}
