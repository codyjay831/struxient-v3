import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { nextResponseForActivateQuoteFailure } from "@/lib/api/activate-quote-failure-response";
import { activateQuoteVersionForTenant } from "@/server/slice1/mutations/activate-quote-version";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";

type RouteContext = { params: Promise<{ quoteVersionId: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  const { quoteVersionId } = await context.params;

  try {
    const result = await activateQuoteVersionForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      quoteVersionId,
      activatedByUserId: authGate.principal.userId,
    });

    if (!result.ok) {
      return nextResponseForActivateQuoteFailure(result);
    }

    return NextResponse.json({
      data: result.data,
      meta: apiAuthMeta(authGate.principal),
    });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
