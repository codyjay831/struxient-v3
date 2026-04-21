import type { PrismaClient, QuoteVersionStatus } from "@prisma/client";

/** Highest `versionNumber` for the quote; list/detail use the same rule. */
export type CommercialQuoteShellLatestVersionDto = {
  id: string;
  versionNumber: number;
  status: QuoteVersionStatus;
  proposalGroupCount: number;
  hasActivation: boolean;
  flowId: string | null;
};

export type CommercialQuoteShellSummaryDto = {
  quote: { id: string; quoteNumber: string; createdAt: string };
  customer: { id: string; name: string };
  flowGroup: { id: string; name: string };
  latestQuoteVersion: CommercialQuoteShellLatestVersionDto | null;
};

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;

export function clampQuoteShellListLimit(raw: string | null): number {
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
  quoteNumber: string;
  createdAt: Date;
  customer: { id: string; name: string };
  flowGroup: { id: string; name: string };
  versions: {
    id: string;
    versionNumber: number;
    status: QuoteVersionStatus;
    _count: { proposalGroups: number };
    activation: { id: string } | null;
    flow: { id: string } | null;
  }[];
}): CommercialQuoteShellSummaryDto {
  const v0 = row.versions[0];
  return {
    quote: {
      id: row.id,
      quoteNumber: row.quoteNumber,
      createdAt: row.createdAt.toISOString(),
    },
    customer: row.customer,
    flowGroup: row.flowGroup,
    latestQuoteVersion: v0
      ? {
          id: v0.id,
          versionNumber: v0.versionNumber,
          status: v0.status,
          proposalGroupCount: v0._count.proposalGroups,
          hasActivation: v0.activation != null,
          flowId: v0.flow?.id ?? null,
        }
      : null,
  };
}

export async function listCommercialQuoteShellsForTenant(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    limit: number;
    /**
     * Optional customer filter. When set, returns only Quote rows whose
     * `customerId` matches. Tenant scoping is preserved by the leading
     * `tenantId` predicate; this filter is additive and never widens visibility.
     */
    customerId?: string;
    /**
     * Optional flow-group (project) filter. When set, returns only Quote rows
     * whose `flowGroupId` matches. Same tenant-scoping guarantee as above.
     */
    flowGroupId?: string;
  },
): Promise<CommercialQuoteShellSummaryDto[]> {
  const where: { tenantId: string; customerId?: string; flowGroupId?: string } = {
    tenantId: params.tenantId,
  };
  if (params.customerId) {
    where.customerId = params.customerId;
  }
  if (params.flowGroupId) {
    where.flowGroupId = params.flowGroupId;
  }
  const rows = await prisma.quote.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: params.limit,
    select: {
      id: true,
      quoteNumber: true,
      createdAt: true,
      customer: { select: { id: true, name: true } },
      flowGroup: { select: { id: true, name: true } },
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
        select: {
          id: true,
          versionNumber: true,
          status: true,
          _count: { select: { proposalGroups: true } },
          activation: { select: { id: true } },
          flow: { select: { id: true } },
        },
      },
    },
  });

  return rows.map(mapRow);
}

export async function getCommercialQuoteShellForTenant(
  prisma: PrismaClient,
  params: { tenantId: string; quoteId: string },
): Promise<CommercialQuoteShellSummaryDto | null> {
  const row = await prisma.quote.findFirst({
    where: { id: params.quoteId, tenantId: params.tenantId },
    select: {
      id: true,
      quoteNumber: true,
      createdAt: true,
      customer: { select: { id: true, name: true } },
      flowGroup: { select: { id: true, name: true } },
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
        select: {
          id: true,
          versionNumber: true,
          status: true,
          _count: { select: { proposalGroups: true } },
          activation: { select: { id: true } },
          flow: { select: { id: true } },
        },
      },
    },
  });

  if (!row) {
    return null;
  }

  return mapRow(row);
}
