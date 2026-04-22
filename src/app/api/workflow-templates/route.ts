import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";
import {
  clampWorkflowTemplateListLimit,
  createWorkflowTemplateForTenant,
  listWorkflowTemplatesForTenant,
} from "@/server/slice1";

export async function GET(request: NextRequest) {
  const authGate = await requireApiPrincipalWithCapability("read");
  if (!authGate.ok) return authGate.response;

  const limit = clampWorkflowTemplateListLimit(request.nextUrl.searchParams.get("limit"));

  try {
    const items = await listWorkflowTemplatesForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      limit,
    });
    return NextResponse.json({
      data: { items, limit },
      meta: apiAuthMeta(authGate.principal),
    });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}

/**
 * POST /api/workflow-templates
 * Body: `{ "templateKey": string, "displayName": string }`
 */
export async function POST(request: NextRequest) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Request body must be JSON." } },
      { status: 400 },
    );
  }

  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { error: { code: "INVALID_BODY", message: "Body must be a JSON object." } },
      { status: 400 },
    );
  }
  const rec = body as Record<string, unknown>;
  const templateKey = rec.templateKey;
  const displayName = rec.displayName;
  if (typeof templateKey !== "string" || typeof displayName !== "string") {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_FIELDS",
          message: "templateKey and displayName are required strings.",
        },
      },
      { status: 400 },
    );
  }

  try {
    const created = await createWorkflowTemplateForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      templateKey,
      displayName,
    });
    return NextResponse.json(
      {
        data: { template: created },
        meta: apiAuthMeta(authGate.principal),
      },
      { status: 201 },
    );
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
