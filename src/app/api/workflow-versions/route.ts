import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import {
  clampWorkflowVersionListLimit,
  listPublishedWorkflowVersionsForTenant,
} from "@/server/slice1/reads/workflow-version-reads";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";

/**
 * Lists **PUBLISHED** workflow versions for the authenticated tenant (for pinning / office discovery).
 * Query: `limit` (1–100, default 50). No draft rows — use detail route if a specific id must be inspected.
 */
export async function GET(request: NextRequest) {
  const authGate = await requireApiPrincipalWithCapability("read");
  if (!authGate.ok) return authGate.response;

  const limit = clampWorkflowVersionListLimit(request.nextUrl.searchParams.get("limit"));

  try {
    const items = await listPublishedWorkflowVersionsForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      limit,
    });

    return NextResponse.json({
      data: { items, limit, filter: "PUBLISHED" as const },
      meta: apiAuthMeta(authGate.principal),
    });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
