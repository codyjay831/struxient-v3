import type { TenantMemberRole } from "@prisma/client";

/**
 * True if applying `newRole` to a user who is currently `OFFICE_ADMIN` would remove the tenant's last admin.
 */
export function wouldDemoteLastOfficeAdmin(
  officeAdminCount: number,
  targetCurrentRole: TenantMemberRole,
  newRole: TenantMemberRole,
): boolean {
  return (
    targetCurrentRole === "OFFICE_ADMIN" &&
    newRole !== "OFFICE_ADMIN" &&
    officeAdminCount <= 1
  );
}
