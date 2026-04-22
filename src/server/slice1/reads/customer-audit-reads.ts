import type { AuditEventType, PrismaClient } from "@prisma/client";
import {
  summaryForCustomerAuditPayload,
  titleForCustomerAuditEventType,
} from "@/lib/customers/customer-audit-labels";

export type CustomerAuditEventListItemDto = {
  id: string;
  eventType: AuditEventType;
  title: string;
  summary: string;
  occurredAtIso: string;
  actorLabel: string | null;
};

/**
 * Recent **system** audit rows for a customer (Epic 57). Tenant + customer anchored; no note body text.
 */
export async function listCustomerAuditEventsForTenant(
  prisma: PrismaClient,
  params: { tenantId: string; customerId: string; limit?: number },
): Promise<CustomerAuditEventListItemDto[] | null> {
  const take = Math.min(Math.max(params.limit ?? 30, 1), 80);

  const customer = await prisma.customer.findFirst({
    where: { id: params.customerId, tenantId: params.tenantId },
    select: { id: true },
  });
  if (!customer) return null;

  const rows = await prisma.auditEvent.findMany({
    where: {
      tenantId: params.tenantId,
      targetCustomerId: params.customerId,
    },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      eventType: true,
      payloadJson: true,
      createdAt: true,
      actor: { select: { email: true, displayName: true } },
    },
  });

  return rows.map((r) => {
    const payload = r.payloadJson as Record<string, unknown> | null;
    return {
      id: r.id,
      eventType: r.eventType,
      title: titleForCustomerAuditEventType(r.eventType),
      summary: summaryForCustomerAuditPayload(r.eventType, payload),
      occurredAtIso: r.createdAt.toISOString(),
      actorLabel: r.actor ? r.actor.displayName?.trim() || r.actor.email : null,
    };
  });
}
