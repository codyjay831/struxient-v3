import type { PrismaClient } from "@prisma/client";

export type FlowGroupCustomerSummaryDto = {
  id: string;
  name: string;
};

/** Narrow flow group row for discovery and attach-mode (`flowGroupId` + `customerId`). */
export type FlowGroupSummaryDto = {
  id: string;
  name: string;
  createdAt: string;
  customer: FlowGroupCustomerSummaryDto;
  quoteCount: number;
  /** Present when a `Job` row exists for this flow group (sign/activate path); otherwise null. */
  jobId: string | null;
};

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;

export function clampFlowGroupListLimit(raw: string | null): number {
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
  name: string;
  createdAt: Date;
  customer: { id: string; name: string };
  job: { id: string } | null;
  _count: { quotes: number };
}): FlowGroupSummaryDto {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    customer: row.customer,
    quoteCount: row._count.quotes,
    jobId: row.job?.id ?? null,
  };
}

export async function listFlowGroupsForTenant(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    limit: number;
    /**
     * Optional customer filter. When set, returns only FlowGroups whose
     * `customerId` matches. Tenant scoping is preserved by the leading
     * `tenantId` predicate; this filter is additive and never widens visibility.
     */
    customerId?: string;
  },
): Promise<FlowGroupSummaryDto[]> {
  const where: { tenantId: string; customerId?: string } = { tenantId: params.tenantId };
  if (params.customerId) {
    where.customerId = params.customerId;
  }
  const rows = await prisma.flowGroup.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: params.limit,
    select: {
      id: true,
      name: true,
      createdAt: true,
      customer: { select: { id: true, name: true } },
      job: { select: { id: true } },
      _count: { select: { quotes: true } },
    },
  });
  return rows.map(mapRow);
}

export async function getFlowGroupForTenant(
  prisma: PrismaClient,
  params: { tenantId: string; flowGroupId: string },
): Promise<FlowGroupSummaryDto | null> {
  const row = await prisma.flowGroup.findFirst({
    where: { id: params.flowGroupId, tenantId: params.tenantId },
    select: {
      id: true,
      name: true,
      createdAt: true,
      customer: { select: { id: true, name: true } },
      job: { select: { id: true } },
      _count: { select: { quotes: true } },
    },
  });
  if (!row) {
    return null;
  }
  return mapRow(row);
}
