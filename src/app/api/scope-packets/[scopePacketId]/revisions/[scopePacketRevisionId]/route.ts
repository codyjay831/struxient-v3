import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { getScopePacketRevisionDetailForTenant } from "@/server/slice1/reads/scope-packet-catalog-reads";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";

type RouteContext = {
  params: Promise<{ scopePacketId: string; scopePacketRevisionId: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("read");
  if (!authGate.ok) return authGate.response;

  const { scopePacketId, scopePacketRevisionId } = await context.params;

  try {
    const detail = await getScopePacketRevisionDetailForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      scopePacketId,
      scopePacketRevisionId,
    });
    if (!detail) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "ScopePacketRevision not found in this tenant or does not belong to this packet.",
          },
        },
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
