import type { PrismaClient, WorkflowVersionStatus } from "@prisma/client";

export type WorkflowTemplateSummaryDto = {
  id: string;
  templateKey: string;
  displayName: string;
};

export type WorkflowVersionListRowDto = {
  id: string;
  versionNumber: number;
  status: WorkflowVersionStatus;
  publishedAtIso: string | null;
  /** Present when this DRAFT was created via fork-from-published/superseded (Epic 23). */
  forkedFromWorkflowVersionId: string | null;
  forkedFromVersionNumber: number | null;
};

/** Office template detail: header + ordered versions (newest first). */
export type WorkflowTemplateDetailDto = {
  template: WorkflowTemplateSummaryDto;
  versions: WorkflowVersionListRowDto[];
};

/** Single version for office editor / read-only view (includes snapshot). */
export type WorkflowVersionOfficeDetailDto = {
  id: string;
  workflowTemplateId: string;
  templateKey: string;
  templateDisplayName: string;
  versionNumber: number;
  status: WorkflowVersionStatus;
  publishedAtIso: string | null;
  snapshotJson: unknown;
  forkedFromWorkflowVersionId: string | null;
  /** Version number of the fork source row (same template), for office hints. */
  forkedFromVersionNumber: number | null;
};

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;

export function clampWorkflowTemplateListLimit(raw: string | null): number {
  if (raw == null || raw === "") {
    return DEFAULT_LIST_LIMIT;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) {
    return DEFAULT_LIST_LIMIT;
  }
  return Math.min(n, MAX_LIST_LIMIT);
}

export async function listWorkflowTemplatesForTenant(
  prisma: PrismaClient,
  params: { tenantId: string; limit: number },
): Promise<WorkflowTemplateSummaryDto[]> {
  const rows = await prisma.workflowTemplate.findMany({
    where: { tenantId: params.tenantId },
    select: { id: true, templateKey: true, displayName: true },
    orderBy: [{ displayName: "asc" }, { templateKey: "asc" }],
    take: params.limit,
  });
  return rows;
}

export async function getWorkflowTemplateForTenant(
  prisma: PrismaClient,
  params: { tenantId: string; workflowTemplateId: string },
): Promise<WorkflowTemplateSummaryDto | null> {
  const row = await prisma.workflowTemplate.findFirst({
    where: { id: params.workflowTemplateId, tenantId: params.tenantId },
    select: { id: true, templateKey: true, displayName: true },
  });
  return row;
}

export async function getWorkflowTemplateDetailForTenant(
  prisma: PrismaClient,
  params: { tenantId: string; workflowTemplateId: string },
): Promise<WorkflowTemplateDetailDto | null> {
  const template = await getWorkflowTemplateForTenant(prisma, params);
  if (!template) return null;

  const versions = await prisma.workflowVersion.findMany({
    where: { workflowTemplateId: template.id },
    select: {
      id: true,
      versionNumber: true,
      status: true,
      publishedAt: true,
      forkedFromWorkflowVersionId: true,
      forkedFromWorkflowVersion: { select: { versionNumber: true } },
    },
    orderBy: { versionNumber: "desc" },
  });

  return {
    template,
    versions: versions.map((v) => ({
      id: v.id,
      versionNumber: v.versionNumber,
      status: v.status,
      publishedAtIso: v.publishedAt != null ? v.publishedAt.toISOString() : null,
      forkedFromWorkflowVersionId: v.forkedFromWorkflowVersionId,
      forkedFromVersionNumber: v.forkedFromWorkflowVersion?.versionNumber ?? null,
    })),
  };
}

export async function getWorkflowVersionOfficeDetailForTenant(
  prisma: PrismaClient,
  params: { tenantId: string; workflowTemplateId: string; workflowVersionId: string },
): Promise<WorkflowVersionOfficeDetailDto | null> {
  const row = await prisma.workflowVersion.findFirst({
    where: {
      id: params.workflowVersionId,
      workflowTemplateId: params.workflowTemplateId,
      workflowTemplate: { tenantId: params.tenantId },
    },
    select: {
      id: true,
      workflowTemplateId: true,
      versionNumber: true,
      status: true,
      publishedAt: true,
      snapshotJson: true,
      forkedFromWorkflowVersionId: true,
      forkedFromWorkflowVersion: { select: { versionNumber: true } },
      workflowTemplate: { select: { templateKey: true, displayName: true } },
    },
  });
  if (!row) return null;

  return {
    id: row.id,
    workflowTemplateId: row.workflowTemplateId,
    templateKey: row.workflowTemplate.templateKey,
    templateDisplayName: row.workflowTemplate.displayName,
    versionNumber: row.versionNumber,
    status: row.status,
    publishedAtIso: row.publishedAt != null ? row.publishedAt.toISOString() : null,
    snapshotJson: row.snapshotJson,
    forkedFromWorkflowVersionId: row.forkedFromWorkflowVersionId,
    forkedFromVersionNumber: row.forkedFromWorkflowVersion?.versionNumber ?? null,
  };
}
