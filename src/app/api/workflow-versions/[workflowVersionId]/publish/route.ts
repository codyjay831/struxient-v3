import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";
import { publishWorkflowVersionForTenant } from "@/server/slice1";

type RouteContext = { params: Promise<{ workflowVersionId: string }> };

/**
 * POST /api/workflow-versions/[workflowVersionId]/publish
 *
 * Publishes a **DRAFT** version; demotes sibling **PUBLISHED** rows to **SUPERSEDED**.
 */
export async function POST(_request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  const { workflowVersionId } = await context.params;

  try {
    const result = await publishWorkflowVersionForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      workflowVersionId,
      userId: authGate.principal.userId,
    });
    if (result === "not_found") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Workflow version not found for tenant." } },
        { status: 404 },
      );
    }
    return NextResponse.json({
      data: { publish: result },
      meta: apiAuthMeta(authGate.principal),
    });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
