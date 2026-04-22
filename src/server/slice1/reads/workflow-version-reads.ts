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
  /** Null for honest DRAFT rows; ISO string when published or superseded with a recorded publish time. */
  publishedAt: string | null;
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

/** Maps a DB row to the discovery DTO; exported for unit tests. */
export function toWorkflowVersionDiscoveryDto(row: {
  id: string;
  versionNumber: number;
  status: WorkflowVersionStatus;
  publishedAt: Date | null;
  workflowTemplate: { id: string; displayName: string; templateKey: string };
}): WorkflowVersionDiscoveryItemDto {
  return {
    id: row.id,
    workflowTemplateId: row.workflowTemplate.id,
    templateDisplayName: row.workflowTemplate.displayName,
    templateKey: row.workflowTemplate.templateKey,
    versionNumber: row.versionNumber,
    status: row.status,
    publishedAt: row.publishedAt != null ? row.publishedAt.toISOString() : null,
  };
}

/**
 * **Published only** — matches `setPinnedWorkflowVersionForTenant` pin target rule:
 * status `PUBLISHED` and a non-null `publishedAt` (actually publishable / historically published).
 * Excludes `DRAFT`, `SUPERSEDED`, and malformed `PUBLISHED` rows missing `publishedAt`.
 * Tenant scope: `WorkflowTemplate.tenantId`.
 */
export async function listPublishedWorkflowVersionsForTenant(
  prisma: PrismaClient,
  params: { tenantId: string; limit: number },
): Promise<WorkflowVersionDiscoveryItemDto[]> {
  const rows = await prisma.workflowVersion.findMany({
    where: {
      status: "PUBLISHED",
      publishedAt: { not: null },
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
  return rows.map(toWorkflowVersionDiscoveryDto);
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
  return toWorkflowVersionDiscoveryDto(row);
}
