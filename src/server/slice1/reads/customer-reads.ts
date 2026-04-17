import type { PrismaClient } from "@prisma/client";

/** Narrow customer row for discovery and attach-mode (`customerId`). */
export type CustomerSummaryDto = {
  id: string;
  name: string;
  createdAt: string;
  /** Count of `FlowGroup` rows for this customer (tenant-scoped via customer). */
  flowGroupCount: number;
  /** Count of `Quote` rows for this customer. */
  quoteCount: number;
};

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;

export function clampCustomerListLimit(raw: string | null): number {
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
  _count: { flowGroups: number; quotes: number };
}): CustomerSummaryDto {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    flowGroupCount: row._count.flowGroups,
    quoteCount: row._count.quotes,
  };
}

export async function listCustomersForTenant(
  prisma: PrismaClient,
  params: { tenantId: string; limit: number },
): Promise<CustomerSummaryDto[]> {
  const rows = await prisma.customer.findMany({
    where: { tenantId: params.tenantId },
    orderBy: { createdAt: "desc" },
    take: params.limit,
    select: {
      id: true,
      name: true,
      createdAt: true,
      _count: { select: { flowGroups: true, quotes: true } },
    },
  });
  return rows.map(mapRow);
}

export async function getCustomerForTenant(
  prisma: PrismaClient,
  params: { tenantId: string; customerId: string },
): Promise<CustomerSummaryDto | null> {
  const row = await prisma.customer.findFirst({
    where: { id: params.customerId, tenantId: params.tenantId },
    select: {
      id: true,
      name: true,
      createdAt: true,
      _count: { select: { flowGroups: true, quotes: true } },
    },
  });
  if (!row) {
    return null;
  }
  return mapRow(row);
}
