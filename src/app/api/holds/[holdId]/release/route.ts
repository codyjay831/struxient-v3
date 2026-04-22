import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";
import { releaseHoldForTenant } from "@/server/slice1/mutations/hold-mutations";

type RouteContext = { params: Promise<{ holdId: string }> };

/** POST …/release — set hold to **RELEASED** (`office_mutate`). */
export async function POST(_request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  const { holdId } = await context.params;

  try {
    await releaseHoldForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      holdId,
      releasedById: authGate.principal.userId,
    });

    return NextResponse.json({ data: { released: true }, meta: apiAuthMeta(authGate.principal) });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
