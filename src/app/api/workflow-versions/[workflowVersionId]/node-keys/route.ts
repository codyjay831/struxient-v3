import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { getWorkflowVersionNodeKeysForTenant } from "@/server/slice1/reads/workflow-version-node-keys";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";

type RouteContext = { params: Promise<{ workflowVersionId: string }> };

/**
 * Narrow projection of pinned-workflow snapshot node ids (with derived task counts)
 * for the QuoteLocalPacketItem `targetNodeKey` picker. **No snapshotJson exposure.**
 *
 * Wrong tenant or unknown id → 404 (no leak). Mirrors the contract of
 * `GET /api/workflow-versions/[id]`.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("read");
  if (!authGate.ok) return authGate.response;

  const { workflowVersionId } = await context.params;

  try {
    const dto = await getWorkflowVersionNodeKeysForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      workflowVersionId,
    });

    if (!dto) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Workflow version not found for tenant" } },
        { status: 404 },
      );
    }

    return NextResponse.json({
      data: dto,
      meta: apiAuthMeta(authGate.principal),
    });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
