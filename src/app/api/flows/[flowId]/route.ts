import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { toFlowExecutionApiDto } from "@/lib/flow-execution-dto";
import { getFlowExecutionReadModel } from "@/server/slice1/reads/flow-execution";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";

type RouteContext = { params: Promise<{ flowId: string }> };

/** Flow-centric execution view (epic 36 lite): skeleton parse + runtime tasks + activation. */
export async function GET(_request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("read");
  if (!authGate.ok) return authGate.response;

  const { flowId } = await context.params;

  try {
    const model = await getFlowExecutionReadModel(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      flowId,
    });

    if (!model) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Flow not found for tenant" } },
        { status: 404 },
      );
    }

    return NextResponse.json({
      data: toFlowExecutionApiDto(model),
      meta: apiAuthMeta(authGate.principal),
    });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
