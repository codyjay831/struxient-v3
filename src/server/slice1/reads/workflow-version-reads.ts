import type { PrismaClient, WorkflowVersionStatus } from "@prisma/client";

/**
 * Compact row for pinning / office discovery. **No snapshotJson** — not a snapshot inspection API.
 */
export type WorkflowVersionDiscoveryItemDto = {
  id: string;
  workflowTemplateId: string;
  templateDisplayName: string;
  templateKey: string;
  versionNumber: number;
  status: WorkflowVersionStatus;
  publishedAt: string;
};

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;

export function clampWorkflowVersionListLimit(raw: string | null): number {
  if (raw == null || raw === "") {
    return DEFAULT_LIST_LIMIT;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) {
    return DEFAULT_LIST_LIMIT;
  }
  return Math.min(n, MAX_LIST_LIMIT);
}

function mapRow(row: {
  id: string;
  versionNumber: number;
  status: WorkflowVersionStatus;
  publishedAt: Date;
  workflowTemplate: { id: string; displayName: string; templateKey: string };
}): WorkflowVersionDiscoveryItemDto {
  return {
    id: row.id,
    workflowTemplateId: row.workflowTemplate.id,
    templateDisplayName: row.workflowTemplate.displayName,
    templateKey: row.workflowTemplate.templateKey,
    versionNumber: row.versionNumber,
    status: row.status,
    publishedAt: row.publishedAt.toISOString(),
  };
}

/**
 * **Published only** — matches `setPinnedWorkflowVersionForTenant` pin target rule.
 * Tenant scope: `WorkflowTemplate.tenantId`.
 */
export async function listPublishedWorkflowVersionsForTenant(
  prisma: PrismaClient,
  params: { tenantId: string; limit: number },
): Promise<WorkflowVersionDiscoveryItemDto[]> {
  const rows = await prisma.workflowVersion.findMany({
    where: {
      status: "PUBLISHED",
      workflowTemplate: { tenantId: params.tenantId },
    },
    select: {
      id: true,
      versionNumber: true,
      status: true,
      publishedAt: true,
      workflowTemplate: { select: { id: true, displayName: true, templateKey: true } },
    },
    orderBy: [{ workflowTemplate: { displayName: "asc" } }, { versionNumber: "desc" }],
    take: params.limit,
  });
  return rows.map(mapRow);
}

/**
 * Single version by id when owned by tenant (any status). Caller can see `status` before pinning a draft id.
 */
export async function getWorkflowVersionDiscoveryForTenant(
  prisma: PrismaClient,
  params: { tenantId: string; workflowVersionId: string },
): Promise<WorkflowVersionDiscoveryItemDto | null> {
  const row = await prisma.workflowVersion.findFirst({
    where: {
      id: params.workflowVersionId,
      workflowTemplate: { tenantId: params.tenantId },
    },
    select: {
      id: true,
      versionNumber: true,
      status: true,
      publishedAt: true,
      workflowTemplate: { select: { id: true, displayName: true, templateKey: true } },
    },
  });
  if (!row) {
    return null;
  }
  return mapRow(row);
}
