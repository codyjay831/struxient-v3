import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";
import { sendFlowShareForTenant, type SendFlowShareRequestBody } from "@/server/slice1/mutations/flow-share-delivery";

type RouteContext = { params: Promise<{ flowId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  const { flowId } = await context.params;

  let requestBody: SendFlowShareRequestBody | null = null;

  const ct = request.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    try {
      const body = (await request.json()) as any;
      if (
        (body.method === "EMAIL" || body.method === "SMS" || body.method === "MANUAL_LINK") &&
        typeof body.recipientDetail === "string"
      ) {
        const origin = new URL(request.url).origin;
        requestBody = {
          method: body.method,
          recipientDetail: body.recipientDetail.trim(),
          baseUrl: origin,
          isFollowUp: !!body.isFollowUp,
        };
      }
    } catch {
      return NextResponse.json(
        { error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } },
        { status: 400 },
      );
    }
  }

  if (!requestBody) {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "Delivery method and recipient detail are required." } },
      { status: 400 },
    );
  }

  try {
    const result = await sendFlowShareForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      flowId,
      actorUserId: authGate.principal.userId,
      request: requestBody,
    });

    if (result.ok === false) {
      if (result.kind === "not_found") {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Flow not found for tenant." } },
          { status: 404 },
        );
      }
      if (result.kind === "not_published") {
        return NextResponse.json(
          { error: { code: "NOT_PUBLISHED", message: "Flow evidence must be published before sharing." } },
          { status: 409 },
        );
      }
      if (result.kind === "invalid_actor") {
        return NextResponse.json(
          { error: { code: "INVALID_ACTOR", message: "Deliverer not found in tenant." } },
          { status: 403 },
        );
      }
    }

    if (!result.ok) {
        throw new Error("Unexpected delivery result");
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
