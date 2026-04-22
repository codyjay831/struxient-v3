import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { toJobHandoffApiDto } from "@/lib/job-handoff-dto";
import { getJobHandoffForTenant } from "@/server/slice1/reads/job-handoff-reads";
import { upsertJobHandoffDraftForTenant } from "@/server/slice1/mutations/job-handoff-mutations";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";

type RouteContext = { params: Promise<{ jobId: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("read");
  if (!authGate.ok) return authGate.response;

  const { jobId } = await context.params;

  try {
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

export async function PUT(request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  const { jobId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "BAD_JSON", message: "Invalid JSON body" } }, { status: 400 });
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const briefingNotes =
    "briefingNotes" in o && (typeof o.briefingNotes === "string" || o.briefingNotes === null)
      ? (o.briefingNotes as string | null)
      : undefined;
  const assignedUserIds =
    "assignedUserIds" in o && Array.isArray(o.assignedUserIds)
      ? o.assignedUserIds.filter((x): x is string => typeof x === "string")
      : undefined;

  try {
    const result = await upsertJobHandoffDraftForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      jobId,
      actorUserId: authGate.principal.userId,
      input: { briefingNotes, assignedUserIds },
    });

    if (!result.ok) {
      const status =
        result.kind === "job_not_found"
          ? 404
          : result.kind === "not_activated"
            ? 422
            : result.kind === "invalid_assignees" || result.kind === "briefing_too_long"
              ? 400
              : 409;
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
