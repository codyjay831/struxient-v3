import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";
import { replaceWorkflowVersionDraftSnapshotForTenant } from "@/server/slice1";

type RouteContext = { params: Promise<{ workflowVersionId: string }> };

/**
 * PUT /api/workflow-versions/[workflowVersionId]/snapshot
 * Body: `{ "snapshotJson": object }` — whole snapshot replace; **DRAFT only**.
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  const { workflowVersionId } = await context.params;

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
  if (!Object.prototype.hasOwnProperty.call(rec, "snapshotJson")) {
    return NextResponse.json(
      { error: { code: "MISSING_FIELD", message: "Field `snapshotJson` is required." } },
      { status: 400 },
    );
  }

  try {
    const result = await replaceWorkflowVersionDraftSnapshotForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      workflowVersionId,
      snapshotJson: rec.snapshotJson,
    });
    if (result === "not_found") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Workflow version not found for tenant." } },
        { status: 404 },
      );
    }
    return NextResponse.json({
      data: { workflowVersion: result },
      meta: apiAuthMeta(authGate.principal),
    });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
