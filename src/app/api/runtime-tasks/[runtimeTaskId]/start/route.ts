import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";
import { startRuntimeTaskForTenant } from "@/server/slice1/mutations/runtime-task-execution";

type RouteContext = { params: Promise<{ runtimeTaskId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("field_execute");
  if (!authGate.ok) return authGate.response;

  const { runtimeTaskId } = await context.params;

  let notes: string | null = null;
  const ct = request.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    try {
      const body = (await request.json()) as { notes?: unknown };
      if (typeof body.notes === "string") {
        notes = body.notes;
      } else if (body.notes === null) {
        notes = null;
      }
    } catch {
      return NextResponse.json(
        { error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } },
        { status: 400 },
      );
    }
  }

  try {
    const result = await startRuntimeTaskForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      runtimeTaskId,
      actorUserId: authGate.principal.userId,
      request: { notes },
    });

    if (result.ok === false && result.kind === "not_found") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Runtime task not found for tenant" } },
        { status: 404 },
      );
    }
    if (result.ok === false && result.kind === "already_completed") {
      return NextResponse.json(
        {
          error: {
            code: "RUNTIME_TASK_ALREADY_COMPLETED",
            message: "Cannot start a runtime task that is already completed.",
          },
        },
        { status: 409 },
      );
    }
    if (result.ok === false && result.kind === "flow_not_activated") {
      return NextResponse.json(
        {
          error: {
            code: "FLOW_NOT_ACTIVATED",
            message: "Flow has no Activation row; runtime execution is blocked until activation (epic 33).",
          },
        },
        { status: 409 },
      );
    }
    if (result.ok === false && result.kind === "payment_gate_unsatisfied") {
      return NextResponse.json(
        {
          error: {
            code: "PAYMENT_GATE_UNSATISFIED",
            message: "An unsatisfied payment gate targets this task; start is blocked until finance satisfies the gate.",
          },
        },
        { status: 409 },
      );
    }
    if (result.ok === false && result.kind === "hold_active") {
      return NextResponse.json(
        {
          error: {
            code: "HOLD_ACTIVE",
            message: "An active operational hold blocks starting this task until office releases it.",
          },
        },
        { status: 409 },
      );
    }
    if (!result.ok) {
      throw new Error("Unexpected start runtime task result");
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
