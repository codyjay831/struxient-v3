import type { LeadStatus, PrismaClient } from "@prisma/client";

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;

export function clampLeadListLimit(raw: number | null | undefined): number {
  if (raw == null || !Number.isFinite(raw) || raw < 1) {
    return DEFAULT_LIST_LIMIT;
  }
  return Math.min(Math.floor(raw), MAX_LIST_LIMIT);
}

export type LeadSummaryDto = {
  id: string;
  displayName: string;
  status: LeadStatus;
  source: string | null;
  primaryEmail: string | null;
  primaryPhone: string | null;
  assignedToUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LeadDetailDto = LeadSummaryDto & {
  summary: string | null;
  createdById: string;
  lostReason: string | null;
  convertedAt: string | null;
  convertedCustomerId: string | null;
  convertedFlowGroupId: string | null;
};

function mapSummary(row: {
  id: string;
  displayName: string;
  status: LeadStatus;
  source: string | null;
  primaryEmail: string | null;
  primaryPhone: string | null;
  assignedToUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): LeadSummaryDto {
  return {
    id: row.id,
    displayName: row.displayName,
    status: row.status,
    source: row.source,
    primaryEmail: row.primaryEmail,
    primaryPhone: row.primaryPhone,
    assignedToUserId: row.assignedToUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listLeadsForTenant(
  prisma: PrismaClient,
  params: { tenantId: string; limit?: number | null },
): Promise<LeadSummaryDto[]> {
  const limit = clampLeadListLimit(params.limit);
  const rows = await prisma.lead.findMany({
    where: { tenantId: params.tenantId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      displayName: true,
      status: true,
      source: true,
      primaryEmail: true,
      primaryPhone: true,
      assignedToUserId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return rows.map(mapSummary);
}

export async function getLeadForTenant(
  prisma: PrismaClient,
  params: { tenantId: string; leadId: string },
): Promise<LeadDetailDto | null> {
  const row = await prisma.lead.findFirst({
    where: { id: params.leadId, tenantId: params.tenantId },
    select: {
      id: true,
      displayName: true,
      status: true,
      source: true,
      primaryEmail: true,
      primaryPhone: true,
      summary: true,
      assignedToUserId: true,
      createdById: true,
      lostReason: true,
      convertedAt: true,
      convertedCustomerId: true,
      convertedFlowGroupId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!row) {
    return null;
  }
  return {
    ...mapSummary(row),
    summary: row.summary,
    createdById: row.createdById,
    lostReason: row.lostReason,
    convertedAt: row.convertedAt?.toISOString() ?? null,
    convertedCustomerId: row.convertedCustomerId,
    convertedFlowGroupId: row.convertedFlowGroupId,
  };
}
