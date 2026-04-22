import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";
import { updateTenantMemberRoleForTenant } from "@/server/slice1/mutations/tenant-member-role-mutations";

type RouteContext = { params: Promise<{ userId: string }> };

/** Epic 59 — change a tenant member's `TenantMemberRole` (`office_mutate` + last-admin guard). */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  const { userId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "INVALID_JSON", message: "Body must be JSON." } }, { status: 400 });
  }
  const o = body !== null && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const role = o.role;

  try {
    const result = await updateTenantMemberRoleForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      actorUserId: authGate.principal.userId,
      targetUserId: userId,
      role,
    });

    if (result.ok) {
      return NextResponse.json({ data: { user: result.user }, meta: apiAuthMeta(authGate.principal) });
    }

    if (result.kind === "user_not_found") {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "User not found in tenant." } }, { status: 404 });
    }
    if (result.kind === "invalid_actor") {
      return NextResponse.json({ error: { code: "FORBIDDEN", message: "Only office admins can change roles." } }, { status: 403 });
    }
    if (result.kind === "invalid_role") {
      return NextResponse.json(
        { error: { code: "INVALID_ROLE", message: "role must be OFFICE_ADMIN, FIELD_WORKER, or READ_ONLY." } },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        error: {
          code: "WOULD_REMOVE_LAST_OFFICE_ADMIN",
          message: "Cannot demote the last office admin for this tenant.",
        },
      },
      { status: 409 },
    );
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
