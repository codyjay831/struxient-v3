import type { PrismaClient } from "@prisma/client";

export type CustomerNoteSummaryDto = {
  id: string;
  body: string;
  archivedAtIso: string | null;
  createdAtIso: string;
  updatedAtIso: string;
  /** Office UI uses this with the signed-in user to gate edit/archive (author-only mutations). */
  createdById: string;
  createdByLabel: string;
};

/**
 * Active (non-archived) customer notes, newest first. Returns `null` if customer missing for tenant.
 */
export async function listCustomerNotesForTenant(
  prisma: PrismaClient,
  params: { tenantId: string; customerId: string; limit?: number },
): Promise<CustomerNoteSummaryDto[] | null> {
  const take = Math.min(Math.max(params.limit ?? 100, 1), 200);

  const customer = await prisma.customer.findFirst({
    where: { id: params.customerId, tenantId: params.tenantId },
    select: { id: true },
  });
  if (!customer) return null;

  const rows = await prisma.customerNote.findMany({
    where: {
      customerId: params.customerId,
      tenantId: params.tenantId,
      archivedAt: null,
    },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      body: true,
      archivedAt: true,
      createdAt: true,
      updatedAt: true,
      createdById: true,
      createdBy: { select: { email: true, displayName: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    archivedAtIso: r.archivedAt?.toISOString() ?? null,
    createdAtIso: r.createdAt.toISOString(),
    updatedAtIso: r.updatedAt.toISOString(),
    createdById: r.createdById,
    createdByLabel: r.createdBy.displayName?.trim() || r.createdBy.email,
  }));
}
