import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";
import { reviewRuntimeTaskForTenant } from "@/server/slice1/mutations/runtime-task-review";

type RouteContext = { params: Promise<{ runtimeTaskId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  const { runtimeTaskId } = await context.params;

  let action: "ACCEPT" | "REQUEST_CORRECTION" | null = null;
  let feedback: string | null = null;

  const ct = request.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    try {
      const body = (await request.json()) as { 
        action?: unknown;
        feedback?: unknown;
      };
      if (body.action === "ACCEPT" || body.action === "REQUEST_CORRECTION") {
        action = body.action;
      }
      if (typeof body.feedback === "string") {
        feedback = body.feedback;
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
      { error: { code: "INVALID_ACTION", message: "Review action must be ACCEPT or REQUEST_CORRECTION." } },
      { status: 400 },
    );
  }

  try {
    const result = await reviewRuntimeTaskForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      runtimeTaskId,
      actorUserId: authGate.principal.userId,
      request: { action, feedback },
    });

    if (result.ok === false) {
      if (result.kind === "not_found") {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Runtime task not found for tenant" } },
          { status: 404 },
        );
      }
      if (result.kind === "not_completed") {
        return NextResponse.json(
          { error: { code: "TASK_NOT_COMPLETED", message: "Only completed tasks can be reviewed." } },
          { status: 409 },
        );
      }
      if (result.kind === "already_reviewed") {
        return NextResponse.json(
          { error: { code: "ALREADY_REVIEWED", message: "Task has already been accepted." } },
          { status: 409 },
        );
      }
      if (result.kind === "invalid_actor") {
        return NextResponse.json(
          { error: { code: "INVALID_ACTOR", message: "Reviewer not found in tenant." } },
          { status: 403 },
        );
      }
    }

    if (!result.ok) {
        throw new Error("Unexpected review result");
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
