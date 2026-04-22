import type { PrismaClient, TenantMemberRole } from "@prisma/client";

export type TenantMemberSummaryDto = {
  id: string;
  email: string;
  displayName: string | null;
  role: TenantMemberRole;
  createdAtIso: string;
};

/**
 * All users in the tenant (Epic 59). Office-admin surface only at API/UI layer.
 */
export async function listTenantMembersForTenant(
  prisma: PrismaClient,
  params: { tenantId: string },
): Promise<TenantMemberSummaryDto[]> {
  const rows = await prisma.user.findMany({
    where: { tenantId: params.tenantId },
    orderBy: [{ role: "asc" }, { email: "asc" }],
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true,
      createdAt: true,
    },
  });

  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    displayName: r.displayName,
    role: r.role,
    createdAtIso: r.createdAt.toISOString(),
  }));
}
