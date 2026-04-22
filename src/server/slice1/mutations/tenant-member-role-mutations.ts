import type { PrismaClient, TenantMemberRole } from "@prisma/client";
import { wouldDemoteLastOfficeAdmin } from "@/lib/auth/tenant-member-role-rules";

export type UpdateTenantMemberRoleResult =
  | { ok: true; user: { id: string; role: TenantMemberRole } }
  | {
      ok: false;
      kind: "user_not_found" | "invalid_actor" | "invalid_role" | "would_remove_last_office_admin";
    };

const ROLES: TenantMemberRole[] = ["OFFICE_ADMIN", "FIELD_WORKER", "READ_ONLY"];

function parseRole(raw: unknown): TenantMemberRole | null {
  if (typeof raw !== "string") return null;
  return ROLES.includes(raw as TenantMemberRole) ? (raw as TenantMemberRole) : null;
}

/**
 * Change a tenant member's `TenantMemberRole` (Epic 59). Enforces **≥1 OFFICE_ADMIN** invariant.
 */
export async function updateTenantMemberRoleForTenant(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    actorUserId: string;
    targetUserId: string;
    role: unknown;
  },
): Promise<UpdateTenantMemberRoleResult> {
  const actorId = params.actorUserId.trim();
  if (!actorId) return { ok: false, kind: "invalid_actor" };

  const newRole = parseRole(params.role);
  if (!newRole) return { ok: false, kind: "invalid_role" };

  return prisma.$transaction(async (tx) => {
    const actor = await tx.user.findFirst({
      where: { id: actorId, tenantId: params.tenantId },
      select: { id: true, role: true },
    });
    if (!actor || actor.role !== "OFFICE_ADMIN") {
      return { ok: false, kind: "invalid_actor" } as const;
    }

    const target = await tx.user.findFirst({
      where: { id: params.targetUserId, tenantId: params.tenantId },
      select: { id: true, role: true },
    });
    if (!target) return { ok: false, kind: "user_not_found" } as const;

    const adminCount = await tx.user.count({
      where: { tenantId: params.tenantId, role: "OFFICE_ADMIN" },
    });

    if (wouldDemoteLastOfficeAdmin(adminCount, target.role, newRole)) {
      return { ok: false, kind: "would_remove_last_office_admin" } as const;
    }

    const previous = target.role;

    await tx.user.update({
      where: { id: target.id },
      data: { role: newRole },
    });

    await tx.auditEvent.create({
      data: {
        tenantId: params.tenantId,
        eventType: "TENANT_MEMBER_ROLE_UPDATED",
        actorId: actor.id,
        payloadJson: {
          targetUserId: target.id,
          from: previous,
          to: newRole,
        },
      },
    });

    return { ok: true, user: { id: target.id, role: newRole } } as const;
  });
}
