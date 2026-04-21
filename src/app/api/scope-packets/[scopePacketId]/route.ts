import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { getScopePacketDetailForTenant } from "@/server/slice1/reads/scope-packet-catalog-reads";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";

type RouteContext = { params: Promise<{ scopePacketId: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("read");
  if (!authGate.ok) return authGate.response;

  const { scopePacketId } = await context.params;

  try {
    const detail = await getScopePacketDetailForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      scopePacketId,
    });
    if (!detail) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "ScopePacket not found in this tenant." } },
        { status: 404 },
      );
    }
    return NextResponse.json({ data: detail, meta: apiAuthMeta(authGate.principal) });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
