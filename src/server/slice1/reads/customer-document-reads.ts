import type { PrismaClient } from "@prisma/client";

export type CustomerDocumentSummaryDto = {
  id: string;
  storageKey: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  category: string;
  caption: string | null;
  status: string;
  createdAtIso: string;
  uploadedById: string;
  uploadedByLabel: string;
};

/**
 * Active customer documents, newest first. Returns `null` if the customer is not in-tenant.
 */
export async function listCustomerDocumentsForTenant(
  prisma: PrismaClient,
  params: { tenantId: string; customerId: string; limit?: number },
): Promise<CustomerDocumentSummaryDto[] | null> {
  const take = Math.min(Math.max(params.limit ?? 50, 1), 100);

  const customer = await prisma.customer.findFirst({
    where: { id: params.customerId, tenantId: params.tenantId },
    select: { id: true },
  });
  if (!customer) return null;

  const rows = await prisma.customerDocument.findMany({
    where: {
      customerId: params.customerId,
      tenantId: params.tenantId,
      status: "ACTIVE",
    },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      storageKey: true,
      fileName: true,
      contentType: true,
      sizeBytes: true,
      category: true,
      caption: true,
      status: true,
      createdAt: true,
      uploadedById: true,
      uploadedBy: { select: { email: true, displayName: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    storageKey: r.storageKey,
    fileName: r.fileName,
    contentType: r.contentType,
    sizeBytes: r.sizeBytes,
    category: r.category,
    caption: r.caption,
    status: r.status,
    createdAtIso: r.createdAt.toISOString(),
    uploadedById: r.uploadedById,
    uploadedByLabel: r.uploadedBy.displayName?.trim() || r.uploadedBy.email,
  }));
}
