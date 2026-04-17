import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { getFlowGroupForTenant } from "@/server/slice1/reads/flow-group-reads";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";

type RouteContext = { params: Promise<{ flowGroupId: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("read");
  if (!authGate.ok) return authGate.response;

  const { flowGroupId } = await context.params;

  try {
    const item = await getFlowGroupForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      flowGroupId,
    });

    if (!item) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Flow group not found for tenant" } },
        { status: 404 },
      );
    }

    return NextResponse.json({
      data: item,
      meta: apiAuthMeta(authGate.principal),
    });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
