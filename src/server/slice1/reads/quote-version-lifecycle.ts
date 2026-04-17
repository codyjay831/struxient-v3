import type { PrismaClient } from "@prisma/client";

export type QuoteVersionLifecycleReadModel = {
  quoteVersion: {
    id: string;
    status: string;
    sentAt: Date | null;
    signedAt: Date | null;
    signedById: string | null;
  };
  quote: { id: string; flowGroupId: string };
  job: { id: string; createdAt: Date; flowGroupId: string } | null;
  quoteSignature: {
    id: string;
    signedAt: Date;
    method: string;
    recordedById: string;
  } | null;
  flow: {
    id: string;
    createdAt: Date;
    jobId: string;
    workflowVersionId: string;
    runtimeTaskCount: number;
  } | null;
  activation: {
    id: string;
    activatedAt: Date;
    packageSnapshotSha256: string;
  } | null;
};

/**
 * Tenant-scoped read: version status + Job shell (via FlowGroup) + QuoteSignature after sign;
 * Flow + Activation after Phase 6 activate.
 */
export async function getQuoteVersionLifecycleReadModel(
  client: PrismaClient,
  params: { tenantId: string; quoteVersionId: string },
): Promise<QuoteVersionLifecycleReadModel | null> {
  const row = await client.quoteVersion.findFirst({
    where: { id: params.quoteVersionId, quote: { tenantId: params.tenantId } },
    select: {
      id: true,
      status: true,
      sentAt: true,
      signedAt: true,
      signedById: true,
      quote: {
        select: {
          id: true,
          flowGroupId: true,
          flowGroup: {
            select: {
              job: { select: { id: true, createdAt: true, flowGroupId: true } },
            },
          },
        },
      },
      quoteSignature: {
        select: { id: true, signedAt: true, method: true, recordedById: true },
      },
      flow: {
        select: {
          id: true,
          createdAt: true,
          jobId: true,
          workflowVersionId: true,
          _count: { select: { runtimeTasks: true } },
        },
      },
      activation: {
        select: {
          id: true,
          activatedAt: true,
          packageSnapshotSha256: true,
        },
      },
    },
  });

  if (!row) {
    return null;
  }

  const job = row.quote.flowGroup.job;
  const flow = row.flow;

  return {
    quoteVersion: {
      id: row.id,
      status: row.status,
      sentAt: row.sentAt,
      signedAt: row.signedAt,
      signedById: row.signedById,
    },
    quote: { id: row.quote.id, flowGroupId: row.quote.flowGroupId },
    job: job ? { id: job.id, createdAt: job.createdAt, flowGroupId: job.flowGroupId } : null,
    quoteSignature: row.quoteSignature,
    flow: flow
      ? {
          id: flow.id,
          createdAt: flow.createdAt,
          jobId: flow.jobId,
          workflowVersionId: flow.workflowVersionId,
          runtimeTaskCount: flow._count.runtimeTasks,
        }
      : null,
    activation: row.activation,
  };
}
