import type { PrismaClient } from "@prisma/client";

/**
 * Tenant-scoped discovery row for a Job.
 *
 * Jobs are created during the SIGN step of a quote version and serve as the
 * stable anchor for one or more activated Flows (execution records).
 */
export type JobDiscoveryItemDto = {
  job: {
    id: string;
    createdAt: string;
    flowGroupId: string;
  };
  customer: {
    id: string;
    name: string;
  };
  flowGroup: {
    id: string;
    name: string;
  };
  /** Total flows created for this job (activated from different quote versions). */
  flowCount: number;
  /** Summary of the latest flow if any exist. */
  latestFlow: {
    id: string;
    quoteNumber: string;
    activatedAt: string | null;
  } | null;
};

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;

export function clampJobDiscoveryListLimit(raw: string | null): number {
  if (raw == null || raw === "") {
    return DEFAULT_LIST_LIMIT;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) {
    return DEFAULT_LIST_LIMIT;
  }
  return Math.min(n, MAX_LIST_LIMIT);
}

/**
 * Tenant-scoped list of jobs, newest first.
 */
export async function listJobsForTenant(
  prisma: PrismaClient,
  params: { tenantId: string; limit: number },
): Promise<JobDiscoveryItemDto[]> {
  const rows = await prisma.job.findMany({
    where: { tenantId: params.tenantId },
    orderBy: { createdAt: "desc" },
    take: params.limit,
    select: {
      id: true,
      createdAt: true,
      flowGroupId: true,
      flowGroup: {
        select: {
          id: true,
          name: true,
          customer: { select: { id: true, name: true } },
        },
      },
      flows: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          activation: { select: { activatedAt: true } },
          quoteVersion: {
            select: {
              quote: { select: { quoteNumber: true } },
            },
          },
        },
      },
      _count: { select: { flows: true } },
    },
  });

  return rows.map((row) => {
    const f0 = row.flows[0];
    return {
      job: {
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        flowGroupId: row.flowGroupId,
      },
      customer: row.flowGroup.customer,
      flowGroup: {
        id: row.flowGroup.id,
        name: row.flowGroup.name,
      },
      flowCount: row._count.flows,
      latestFlow: f0
        ? {
            id: f0.id,
            quoteNumber: f0.quoteVersion.quote.quoteNumber,
            activatedAt: f0.activation?.activatedAt.toISOString() ?? null,
          }
        : null,
    };
  });
}
