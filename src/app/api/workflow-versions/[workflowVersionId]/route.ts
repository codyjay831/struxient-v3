import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { getWorkflowVersionDiscoveryForTenant } from "@/server/slice1/reads/workflow-version-reads";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";

type RouteContext = { params: Promise<{ workflowVersionId: string }> };

/**
 * One workflow version shell (template labels + status + publishedAt). **No snapshotJson.**
 * Wrong tenant or unknown id → 404 (no leak).
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("read");
  if (!authGate.ok) return authGate.response;

  const { workflowVersionId } = await context.params;

  try {
    const row = await getWorkflowVersionDiscoveryForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      workflowVersionId,
    });

    if (!row) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Workflow version not found for tenant" } },
        { status: 404 },
      );
    }

    return NextResponse.json({
      data: row,
      meta: apiAuthMeta(authGate.principal),
    });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
