import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";
import { listTenantMembersForTenant } from "@/server/slice1/reads/tenant-team-reads";

/** Epic 59 — list tenant users and roles (`office_mutate` only). */
export async function GET() {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  try {
    const members = await listTenantMembersForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
    });
    return NextResponse.json({ data: { members }, meta: apiAuthMeta(authGate.principal) });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
