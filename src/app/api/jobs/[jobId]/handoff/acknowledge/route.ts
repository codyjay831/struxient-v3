import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { toJobHandoffApiDto } from "@/lib/job-handoff-dto";
import { getJobHandoffForTenant } from "@/server/slice1/reads/job-handoff-reads";
import { acknowledgeJobHandoffForTenant } from "@/server/slice1/mutations/job-handoff-mutations";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, principalHasCapability, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";

type RouteContext = { params: Promise<{ jobId: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("read");
  if (!authGate.ok) return authGate.response;

  const { jobId } = await context.params;

  const canField = principalHasCapability(authGate.principal, "field_execute");

  try {
    const result = await acknowledgeJobHandoffForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      jobId,
      actorUserId: authGate.principal.userId,
      canFieldExecute: canField,
    });

    if (!result.ok) {
      const status =
        result.kind === "job_not_found" || result.kind === "handoff_not_found"
          ? 404
          : result.kind === "not_sent" || result.kind === "not_eligible"
            ? 409
            : 400;
      return NextResponse.json(
        { error: { code: result.kind.toUpperCase(), message: result.kind } },
        { status },
      );
    }

    const row = await getJobHandoffForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      jobId,
    });

    return NextResponse.json({
      data: row ? toJobHandoffApiDto(row) : null,
      meta: apiAuthMeta(authGate.principal),
    });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
