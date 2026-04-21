import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { clampScopePacketListLimit } from "@/lib/scope-packet-catalog-summary";
import { listScopePacketsForTenant } from "@/server/slice1/reads/scope-packet-catalog-reads";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";

export async function GET(request: NextRequest) {
  const authGate = await requireApiPrincipalWithCapability("read");
  if (!authGate.ok) return authGate.response;

  const limit = clampScopePacketListLimit(request.nextUrl.searchParams.get("limit"));

  try {
    const items = await listScopePacketsForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      limit,
    });
    return NextResponse.json({
      data: { items, limit },
      meta: apiAuthMeta(authGate.principal),
    });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
