import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";
import { completeSkeletonTaskForTenant } from "@/server/slice1/mutations/skeleton-task-execution";
import type { RuntimeTaskExecutionRequestBody } from "@/server/slice1/mutations/runtime-task-execution";

type RouteContext = { params: Promise<{ flowId: string; skeletonTaskId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("field_execute");
  if (!authGate.ok) return authGate.response;

  const { flowId, skeletonTaskId } = await context.params;

  let notes: string | null = null;
  let completionProof: {
    note?: string | null;
    attachments?: { key: string; fileName: string; fileSize: number; contentType: string }[];
    checklist?: { label: string; status: "yes" | "no" | "na" }[];
    measurements?: { label: string; value: string; unit?: string }[];
    identifiers?: { label: string; value: string }[];
    overallResult?: string | null;
  } | null = null;
  const ct = request.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    try {
      const body = (await request.json()) as { notes?: unknown; completionProof?: unknown };
      if (typeof body.notes === "string") {
        notes = body.notes;
      } else if (body.notes === null) {
        notes = null;
      }
      if (body.completionProof && typeof body.completionProof === "object") {
        completionProof = body.completionProof as typeof completionProof;
      }
    } catch {
      return NextResponse.json(
        { error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } },
        { status: 400 },
      );
    }
  }

  try {
    const result = await completeSkeletonTaskForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      flowId,
      skeletonTaskId,
      actorUserId: authGate.principal.userId,
      request: {
        notes,
        completionProof: completionProof as RuntimeTaskExecutionRequestBody["completionProof"],
      },
    });

    if (result.ok === false && result.kind === "not_found") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Flow not found for tenant" } },
        { status: 404 },
      );
    }
    if (result.ok === false && result.kind === "unknown_skeleton_task") {
      return NextResponse.json(
        {
          error: {
            code: "UNKNOWN_SKELETON_TASK",
            message:
              "skeletonTaskId is not defined on this flow's pinned workflow snapshot (nodes[].tasks[].id).",
          },
        },
        { status: 400 },
      );
    }
    if (result.ok === false && result.kind === "not_started") {
      return NextResponse.json(
        {
          error: {
            code: "SKELETON_TASK_NOT_STARTED",
            message: "Complete requires a prior STARTED TaskExecution for this skeleton task.",
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
            message: "Flow has no Activation row; execution is blocked until activation (epic 33).",
          },
        },
        { status: 409 },
      );
    }
    if (result.ok === false && result.kind === "validation_failed") {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: "One or more required fields are missing or invalid.",
            details: result.errors,
          },
        },
        { status: 400 },
      );
    }
    if (!result.ok) {
      throw new Error("Unexpected complete skeleton task result");
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
