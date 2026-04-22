import type { PrismaClient } from "@prisma/client";
import {
  DEFAULT_CUSTOMER_DOCUMENT_MAX_BYTES,
  effectiveCustomerDocumentMaxBytes,
  MIN_TENANT_CUSTOMER_DOCUMENT_MAX_BYTES,
  PLATFORM_CUSTOMER_DOCUMENT_MAX_CEILING_BYTES,
} from "@/lib/files/customer-document-policy";
import type { TenantOperationalSettingsDto } from "../reads/tenant-operational-settings-reads";

export type UpdateTenantOperationalSettingsInput = {
  customerDocumentMaxBytes?: number;
};

export type UpdateTenantOperationalSettingsResult =
  | { ok: true; settings: TenantOperationalSettingsDto }
  | { ok: false; kind: "tenant_not_found" | "invalid_actor" | "invalid_customer_document_max_bytes" };

/**
 * Office-admin tenant policy (Epic 60). Currently: customer document upload byte cap.
 */
export async function updateTenantOperationalSettingsForTenant(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    actorUserId: string;
    input: UpdateTenantOperationalSettingsInput;
  },
): Promise<UpdateTenantOperationalSettingsResult> {
  const actorId = params.actorUserId.trim();
  if (!actorId) return { ok: false, kind: "invalid_actor" };

  const raw = params.input.customerDocumentMaxBytes;
  if (raw === undefined) {
    return { ok: false, kind: "invalid_customer_document_max_bytes" };
  }
  if (!Number.isFinite(raw) || !Number.isInteger(raw)) {
    return { ok: false, kind: "invalid_customer_document_max_bytes" };
  }
  const requested = Math.floor(raw);
  if (requested < MIN_TENANT_CUSTOMER_DOCUMENT_MAX_BYTES || requested > PLATFORM_CUSTOMER_DOCUMENT_MAX_CEILING_BYTES) {
    return { ok: false, kind: "invalid_customer_document_max_bytes" };
  }

  const tenant = await prisma.tenant.findFirst({
    where: { id: params.tenantId },
    select: { id: true, customerDocumentMaxBytes: true },
  });
  if (!tenant) return { ok: false, kind: "tenant_not_found" };

  const actor = await prisma.user.findFirst({
    where: { id: actorId, tenantId: params.tenantId },
    select: { id: true },
  });
  if (!actor) return { ok: false, kind: "invalid_actor" };

  const previous = tenant.customerDocumentMaxBytes;

  await prisma.$transaction([
    prisma.tenant.update({
      where: { id: tenant.id },
      data: { customerDocumentMaxBytes: requested },
    }),
    prisma.auditEvent.create({
      data: {
        tenantId: params.tenantId,
        eventType: "TENANT_OPERATIONAL_SETTINGS_UPDATED",
        actorId: actor.id,
        payloadJson: {
          customerDocumentMaxBytes: { from: previous, to: requested },
        },
      },
    }),
  ]);

  const effective = effectiveCustomerDocumentMaxBytes(requested);
  return {
    ok: true,
    settings: {
      customerDocumentMaxBytesStored: requested,
      customerDocumentMaxBytesEffective: effective,
      limits: {
        minBytes: MIN_TENANT_CUSTOMER_DOCUMENT_MAX_BYTES,
        maxBytesCeiling: PLATFORM_CUSTOMER_DOCUMENT_MAX_CEILING_BYTES,
        defaultBytes: DEFAULT_CUSTOMER_DOCUMENT_MAX_BYTES,
      },
    },
  };
}
