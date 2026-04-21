import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { TaskDefinitionStatus } from "@prisma/client";
import { getPrisma } from "@/server/db/prisma";
import {
  clampTaskDefinitionListLimit,
  listTaskDefinitionsForTenant,
} from "@/server/slice1/reads/task-definition-reads";
import { createTaskDefinitionForTenant } from "@/server/slice1/mutations/task-definition-mutations";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";

const VALID_STATUSES: ReadonlySet<TaskDefinitionStatus> = new Set(["DRAFT", "PUBLISHED", "ARCHIVED"]);

function parseStatuses(raw: string | null): TaskDefinitionStatus[] | undefined {
  if (!raw) return undefined;
  const parts = raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s): s is TaskDefinitionStatus => VALID_STATUSES.has(s as TaskDefinitionStatus));
  return parts.length > 0 ? parts : undefined;
}

export async function GET(request: NextRequest) {
  const authGate = await requireApiPrincipalWithCapability("read");
  if (!authGate.ok) return authGate.response;

  const limit = clampTaskDefinitionListLimit(request.nextUrl.searchParams.get("limit"));
  const statuses = parseStatuses(request.nextUrl.searchParams.get("status"));

  try {
    const items = await listTaskDefinitionsForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      limit,
      statuses,
    });
    return NextResponse.json({
      data: { items, limit, statuses: statuses ?? null },
      meta: apiAuthMeta(authGate.principal),
    });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}

export async function POST(request: NextRequest) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

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

  if (typeof o.taskKey !== "string" || typeof o.displayName !== "string") {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_FIELD",
          message: "taskKey and displayName are required strings.",
        },
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
    const created = await createTaskDefinitionForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      taskKey: o.taskKey,
      displayName: o.displayName,
      instructions: (o.instructions as string | null | undefined) ?? null,
      completionRequirements: o.completionRequirements,
      conditionalRules: o.conditionalRules,
    });
    return NextResponse.json(
      { data: created, meta: apiAuthMeta(authGate.principal) },
      { status: 201 },
    );
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
