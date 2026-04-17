import type { PrismaClient, QuoteVersionStatus } from "@prisma/client";

/**
 * Tenant-scoped discovery row for an activated execution record.
 *
 * Every `Flow` row in this codebase is created by the activate path (see schema:
 * `Activation.flowId @unique`, `Flow.quoteVersionId @unique`), so listing Flow rows
 * is the canon-safe way to enumerate activated executions for a tenant.
 *
 * Only fields already present on existing models are exposed — no derived state.
 */
export type FlowDiscoveryItemDto = {
  flow: {
    id: string;
    createdAt: string;
    jobId: string;
  };
  activation: {
    id: string;
    activatedAt: string;
  } | null;
  quote: {
    id: string;
    quoteNumber: string;
  };
  quoteVersion: {
    id: string;
    versionNumber: number;
    status: QuoteVersionStatus;
  };
  customer: {
    id: string;
    name: string;
  };
  flowGroup: {
    id: string;
    name: string;
  };
  workflowVersion: {
    id: string;
    versionNumber: number;
  };
  runtimeTaskCount: number;
};

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;

export function clampFlowDiscoveryListLimit(raw: string | null): number {
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
 * Tenant-scoped list of activated execution records, newest first.
 *
 * Filters by `Flow.tenantId` so the read mirrors the same boundary as
 * `getFlowExecutionReadModel` and the `/api/flows/<flowId>` route.
 */
export async function listFlowsForTenant(
  prisma: PrismaClient,
  params: { tenantId: string; limit: number },
): Promise<FlowDiscoveryItemDto[]> {
  const rows = await prisma.flow.findMany({
    where: { tenantId: params.tenantId },
    orderBy: { createdAt: "desc" },
    take: params.limit,
    select: {
      id: true,
      jobId: true,
      createdAt: true,
      activation: {
        select: { id: true, activatedAt: true },
      },
      workflowVersion: {
        select: { id: true, versionNumber: true },
      },
      quoteVersion: {
        select: {
          id: true,
          versionNumber: true,
          status: true,
          quote: {
            select: {
              id: true,
              quoteNumber: true,
              customer: { select: { id: true, name: true } },
              flowGroup: { select: { id: true, name: true } },
            },
          },
        },
      },
      _count: { select: { runtimeTasks: true } },
    },
  });

  return rows.map((row) => ({
    flow: {
      id: row.id,
      jobId: row.jobId,
      createdAt: row.createdAt.toISOString(),
    },
    activation: row.activation
      ? {
          id: row.activation.id,
          activatedAt: row.activation.activatedAt.toISOString(),
        }
      : null,
    quote: {
      id: row.quoteVersion.quote.id,
      quoteNumber: row.quoteVersion.quote.quoteNumber,
    },
    quoteVersion: {
      id: row.quoteVersion.id,
      versionNumber: row.quoteVersion.versionNumber,
      status: row.quoteVersion.status,
    },
    customer: row.quoteVersion.quote.customer,
    flowGroup: row.quoteVersion.quote.flowGroup,
    workflowVersion: {
      id: row.workflowVersion.id,
      versionNumber: row.workflowVersion.versionNumber,
    },
    runtimeTaskCount: row._count.runtimeTasks,
  }));
}
