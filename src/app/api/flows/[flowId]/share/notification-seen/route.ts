import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";
import { markFlowShareNotificationSeenForTenant } from "@/server/slice1/mutations/flow-share-response";

type RouteContext = { params: Promise<{ flowId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  const { flowId } = await context.params;

  try {
    const result = await markFlowShareNotificationSeenForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      flowId,
    });

    return NextResponse.json({
      data: result,
      meta: apiAuthMeta(authGate.principal),
    });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
