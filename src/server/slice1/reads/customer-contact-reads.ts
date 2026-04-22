import type { CustomerContactMethodType, CustomerContactRole, PrismaClient } from "@prisma/client";

export type CustomerContactMethodDto = {
  id: string;
  type: CustomerContactMethodType;
  value: string;
  isPrimary: boolean;
  okToSms: boolean;
  okToEmail: boolean;
  createdAtIso: string;
};

export type CustomerContactSummaryDto = {
  id: string;
  displayName: string;
  role: CustomerContactRole | null;
  notes: string | null;
  archivedAtIso: string | null;
  createdAtIso: string;
  methods: CustomerContactMethodDto[];
};

const ACTIVE_CONTACTS = { archivedAt: null as null };

/**
 * Active contacts for a tenant-owned customer, with methods (read-only office surface).
 * `isPrimary` on a method is **customer-wide per method type** (EMAIL, PHONE, …): mutations clear other primaries
 * for the same customer and type across **all** of that customer's contacts (including archived).
 *
 * Returns `null` if the customer does not exist for the tenant.
 */
export async function listCustomerContactsForTenant(
  prisma: PrismaClient,
  params: { tenantId: string; customerId: string },
): Promise<CustomerContactSummaryDto[] | null> {
  const customer = await prisma.customer.findFirst({
    where: { id: params.customerId, tenantId: params.tenantId },
    select: { id: true },
  });
  if (!customer) return null;

  const rows = await prisma.customerContact.findMany({
    where: {
      customerId: params.customerId,
      tenantId: params.tenantId,
      ...ACTIVE_CONTACTS,
    },
    orderBy: [{ displayName: "asc" }, { id: "asc" }],
    select: {
      id: true,
      displayName: true,
      role: true,
      notes: true,
      archivedAt: true,
      createdAt: true,
      methods: {
        orderBy: [{ type: "asc" }, { id: "asc" }],
        select: {
          id: true,
          type: true,
          value: true,
          isPrimary: true,
          okToSms: true,
          okToEmail: true,
          createdAt: true,
        },
      },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    displayName: r.displayName,
    role: r.role,
    notes: r.notes,
    archivedAtIso: r.archivedAt?.toISOString() ?? null,
    createdAtIso: r.createdAt.toISOString(),
    methods: r.methods.map((m) => ({
      id: m.id,
      type: m.type,
      value: m.value,
      isPrimary: m.isPrimary,
      okToSms: m.okToSms,
      okToEmail: m.okToEmail,
      createdAtIso: m.createdAt.toISOString(),
    })),
  }));
}
