import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { getGlobalWorkFeedReadModelForTenant } from "@/server/slice1/reads/global-work-feed-reads";
import { toGlobalWorkFeedApiDto } from "@/lib/global-work-feed-dto";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";

/**
 * Tenant-wide execution work feed (Execution Canon, Schema v5); same `read` gate as `GET /api/flows/[flowId]`.
 * Returns runtime tasks on each job's ACTIVE_FLOW only; skeleton and pre-job arrays are intentionally empty.
 */
export async function GET(_request: NextRequest) {
  const authGate = await requireApiPrincipalWithCapability("read");
  if (!authGate.ok) return authGate.response;

  try {
    const model = await getGlobalWorkFeedReadModelForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
    });
    return NextResponse.json({
      data: toGlobalWorkFeedApiDto(model),
      meta: {
        ...apiAuthMeta(authGate.principal),
        notes: [
          "Execution Canon (Schema v5): runtime rows only; restricted to each job's ACTIVE_FLOW with non-superseded RuntimeTask and accepted omitted.",
          "ACTIVE_FLOW(job) = candidate flows have ≥1 RuntimeTask with changeOrderIdSuperseded IS NULL; if multiple, lexicographically max flow.id wins.",
          "isNextForJob: per job, the first runtime task in frozen package slot order whose actionability.start.canStart OR actionability.complete.canComplete is true; at most one per job.",
          "preJobRows and skeletonRows are always empty; PreJobTask is a separate context surface and SkeletonTask is a workflow/template artifact, not execution truth.",
        ],
      },
    });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
