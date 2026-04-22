import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";
import { createOperationalHoldForJob } from "@/server/slice1/mutations/hold-mutations";

type RouteContext = { params: Promise<{ jobId: string }> };

/**
 * POST …/holds — create an **ACTIVE** operational hold on a job (`office_mutate`).
 * Body: `{ reason: string, runtimeTaskId?: string | null }` — omit or null `runtimeTaskId` for job-wide hold.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  const { jobId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "INVALID_JSON", message: "Body must be JSON." } }, { status: 400 });
  }
  const o = body !== null && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};

  try {
    const created = await createOperationalHoldForJob(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      jobId,
      createdById: authGate.principal.userId,
      reason: o.reason,
      runtimeTaskId: o.runtimeTaskId === undefined ? undefined : (o.runtimeTaskId as string | null),
    });

    return NextResponse.json(
      { data: { holdId: created.id }, meta: apiAuthMeta(authGate.principal) },
      { status: 201 },
    );
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
