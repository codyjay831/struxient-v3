import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";
import { retryFlowShareDeliveryForTenant } from "@/server/slice1/mutations/flow-share-delivery";

type RouteContext = { params: Promise<{ flowId: string; deliveryId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  const { deliveryId } = await context.params;
  const origin = new URL(request.url).origin;

  try {
    const result = await retryFlowShareDeliveryForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      deliveryId,
      actorUserId: authGate.principal.userId,
      baseUrl: origin,
    });

    if (result.ok === false) {
      if (result.kind === "not_found") {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Delivery record not found." } },
          { status: 404 },
        );
      }
      if (result.kind === "not_failed") {
        return NextResponse.json(
          { error: { code: "NOT_FAILED", message: "Only failed deliveries can be retried." } },
          { status: 409 },
        );
      }
      if (result.kind === "invalid_actor") {
        return NextResponse.json(
          { error: { code: "INVALID_ACTOR", message: "Actor not found in tenant." } },
          { status: 403 },
        );
      }
    }

    if (!result.ok) {
        throw new Error("Unexpected retry result");
    }

    return NextResponse.json({
      data: result.data,
      meta: apiAuthMeta(authGate.principal),
    });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
