import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { toJobShellApiDto } from "@/lib/job-shell-dto";
import { getJobShellReadModel } from "@/server/slice1/reads/job-shell";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";

type RouteContext = { params: Promise<{ jobId: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("read");
  if (!authGate.ok) return authGate.response;

  const { jobId } = await context.params;

  try {
    const model = await getJobShellReadModel(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      jobId,
    });

    if (!model) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Job not found for tenant" } },
        { status: 404 },
      );
    }

    return NextResponse.json({
      data: toJobShellApiDto(model),
      meta: apiAuthMeta(authGate.principal),
    });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
