import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";
import { manageFlowShareForTenant, type FlowShareAction } from "@/server/slice1/mutations/flow-share";

type RouteContext = { params: Promise<{ flowId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  const { flowId } = await context.params;

  let action: FlowShareAction | null = null;
  let expiresAt: Date | null | undefined = undefined;

  const ct = request.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    try {
      const body = (await request.json()) as { action?: unknown; expiresAt?: unknown };
      if (body.action === "PUBLISH" || body.action === "REVOKE" || body.action === "REGENERATE" || body.action === "SET_EXPIRATION") {
        action = body.action;
      }
      if (body.expiresAt === null) {
        expiresAt = null;
      } else if (typeof body.expiresAt === "string") {
        expiresAt = new Date(body.expiresAt);
      }
    } catch {
      return NextResponse.json(
        { error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } },
        { status: 400 },
      );
    }
  }

  if (!action) {
    return NextResponse.json(
      { error: { code: "INVALID_ACTION", message: "Share action must be PUBLISH, REVOKE, REGENERATE, or SET_EXPIRATION." } },
      { status: 400 },
    );
  }

  try {
    const result = await manageFlowShareForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      flowId,
      actorUserId: authGate.principal.userId,
      action,
      expiresAt,
    });

    if (result.ok === false) {
      if (result.kind === "not_found") {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Flow not found for tenant." } },
          { status: 404 },
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
        throw new Error("Unexpected share result");
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
