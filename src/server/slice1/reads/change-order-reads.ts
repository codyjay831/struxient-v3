import { ChangeOrderStatus, PrismaClient } from "@prisma/client";

export type ChangeOrderDto = {
  id: string;
  jobId: string;
  reason: string;
  status: ChangeOrderStatus;
  draftQuoteVersionId: string | null;
  appliedAt: string | null;
  createdAt: string;
  createdById: string;
  createdByDisplayName: string | null;
};

export async function listChangeOrdersForJob(
  prisma: PrismaClient,
  params: { tenantId: string; jobId: string }
): Promise<ChangeOrderDto[]> {
  const rows = await prisma.changeOrder.findMany({
    where: { jobId: params.jobId, tenantId: params.tenantId },
    include: {
      createdBy: { select: { displayName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((r) => ({
    id: r.id,
    jobId: r.jobId,
    reason: r.reason,
    status: r.status,
    draftQuoteVersionId: r.draftQuoteVersionId,
    appliedAt: r.appliedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    createdById: r.createdById,
    createdByDisplayName: r.createdBy.displayName,
  }));
}

export async function getChangeOrderForTenant(
  prisma: PrismaClient,
  params: { tenantId: string; changeOrderId: string }
): Promise<ChangeOrderDto | null> {
  const r = await prisma.changeOrder.findFirst({
    where: { id: params.changeOrderId, tenantId: params.tenantId },
    include: {
      createdBy: { select: { displayName: true } },
    },
  });

  if (!r) return null;

  return {
    id: r.id,
    jobId: r.jobId,
    reason: r.reason,
    status: r.status,
    draftQuoteVersionId: r.draftQuoteVersionId,
    appliedAt: r.appliedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    createdById: r.createdById,
    createdByDisplayName: r.createdBy.displayName,
  };
}
