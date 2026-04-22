import type { PrismaClient } from "@prisma/client";
import {
  DEFAULT_CUSTOMER_DOCUMENT_MAX_BYTES,
  effectiveCustomerDocumentMaxBytes,
  MIN_TENANT_CUSTOMER_DOCUMENT_MAX_BYTES,
  PLATFORM_CUSTOMER_DOCUMENT_MAX_CEILING_BYTES,
} from "@/lib/files/customer-document-policy";

export type TenantOperationalSettingsDto = {
  customerDocumentMaxBytesStored: number;
  customerDocumentMaxBytesEffective: number;
  limits: {
    minBytes: number;
    maxBytesCeiling: number;
    defaultBytes: number;
  };
};

export async function getTenantOperationalSettingsForTenant(
  prisma: PrismaClient,
  params: { tenantId: string },
): Promise<TenantOperationalSettingsDto | null> {
  const row = await prisma.tenant.findFirst({
    where: { id: params.tenantId },
    select: { id: true, customerDocumentMaxBytes: true },
  });
  if (!row) return null;

  const stored = row.customerDocumentMaxBytes;
  return {
    customerDocumentMaxBytesStored: stored,
    customerDocumentMaxBytesEffective: effectiveCustomerDocumentMaxBytes(stored),
    limits: {
      minBytes: MIN_TENANT_CUSTOMER_DOCUMENT_MAX_BYTES,
      maxBytesCeiling: PLATFORM_CUSTOMER_DOCUMENT_MAX_CEILING_BYTES,
      defaultBytes: DEFAULT_CUSTOMER_DOCUMENT_MAX_BYTES,
    },
  };
}
