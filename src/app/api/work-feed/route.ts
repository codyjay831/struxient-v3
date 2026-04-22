import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { getGlobalWorkFeedReadModelForTenant } from "@/server/slice1/reads/global-work-feed-reads";
import { toGlobalWorkFeedApiDto } from "@/lib/global-work-feed-dto";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";

/** Cross-flow runtime task discovery (Epic 39); same `read` gate as `GET /api/flows/[flowId]`. */
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
          "Runtime rows: manifest tasks only; accepted omitted; same actionability as GET /api/flows/[flowId].",
          "Skeleton rows: parsed from pinned workflow snapshot + SKELETON TaskExecutions; evaluateSkeletonTaskActionability; accepted omitted.",
          "Pre-job rows: PreJobTask lifecycle status only; DONE/CANCELLED omitted.",
          "Skeleton flow scan and row caps may truncate; sort is stable — not dispatch priority.",
        ],
      },
    });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
