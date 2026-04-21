import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { TaskDefinitionStatus } from "@prisma/client";
import { getPrisma } from "@/server/db/prisma";
import { getTaskDefinitionDetailForTenant } from "@/server/slice1/reads/task-definition-reads";
import {
  setTaskDefinitionStatusForTenant,
  updateTaskDefinitionForTenant,
} from "@/server/slice1/mutations/task-definition-mutations";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";

type RouteContext = { params: Promise<{ taskDefinitionId: string }> };

const VALID_STATUSES: ReadonlySet<TaskDefinitionStatus> = new Set(["DRAFT", "PUBLISHED", "ARCHIVED"]);

export async function GET(_request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("read");
  if (!authGate.ok) return authGate.response;

  const { taskDefinitionId } = await context.params;
  try {
    const detail = await getTaskDefinitionDetailForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      taskDefinitionId,
    });
    if (!detail) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "TaskDefinition not found in this tenant." } },
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

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  const { taskDefinitionId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Request body must be JSON" } },
      { status: 400 },
    );
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { error: { code: "INVALID_BODY", message: "Body must be a JSON object" } },
      { status: 400 },
    );
  }
  const o = body as Record<string, unknown>;

  // Status transition is mutually exclusive with content edits — keep the API surface honest.
  if (o.status !== undefined) {
    const otherKeys = Object.keys(o).filter((k) => k !== "status");
    if (otherKeys.length > 0) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_BODY",
            message: "When 'status' is set, no other fields may be sent in the same request.",
            context: { rejectedKeys: otherKeys },
          },
        },
        { status: 400 },
      );
    }
    if (typeof o.status !== "string" || !VALID_STATUSES.has(o.status as TaskDefinitionStatus)) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_FIELD",
            message: "status must be DRAFT, PUBLISHED, or ARCHIVED.",
          },
        },
        { status: 400 },
      );
    }
    try {
      const detail = await setTaskDefinitionStatusForTenant(getPrisma(), {
        tenantId: authGate.principal.tenantId,
        taskDefinitionId,
        nextStatus: o.status as TaskDefinitionStatus,
      });
      return NextResponse.json({ data: detail, meta: apiAuthMeta(authGate.principal) });
    } catch (e) {
      const json = jsonResponseForCaughtError(e);
      if (json) return json;
      throw e;
    }
  }

  if (o.displayName !== undefined && typeof o.displayName !== "string") {
    return NextResponse.json(
      {
        error: { code: "INVALID_FIELD", message: "displayName must be a string when provided." },
      },
      { status: 400 },
    );
  }
  if (
    o.instructions !== undefined &&
    o.instructions !== null &&
    typeof o.instructions !== "string"
  ) {
    return NextResponse.json(
      {
        error: { code: "INVALID_FIELD", message: "instructions must be a string or null." },
      },
      { status: 400 },
    );
  }
  if (o.completionRequirements !== undefined && !Array.isArray(o.completionRequirements)) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_FIELD",
          message: "completionRequirements must be an array when provided.",
        },
      },
      { status: 400 },
    );
  }
  if (o.conditionalRules !== undefined && !Array.isArray(o.conditionalRules)) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_FIELD",
          message: "conditionalRules must be an array when provided.",
        },
      },
      { status: 400 },
    );
  }

  try {
    const detail = await updateTaskDefinitionForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      taskDefinitionId,
      displayName: o.displayName as string | undefined,
      instructions:
        o.instructions === undefined ? undefined : (o.instructions as string | null),
      completionRequirements: o.completionRequirements,
      conditionalRules: o.conditionalRules,
    });
    return NextResponse.json({ data: detail, meta: apiAuthMeta(authGate.principal) });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
