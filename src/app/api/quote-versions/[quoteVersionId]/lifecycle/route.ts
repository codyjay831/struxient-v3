import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { toQuoteVersionLifecycleApiDto } from "@/lib/quote-version-lifecycle-dto";
import { getQuoteVersionLifecycleReadModel } from "@/server/slice1/reads/quote-version-lifecycle";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";

type RouteContext = { params: Promise<{ quoteVersionId: string }> };

/** Job + signature + status (bridge before Phase 6 Flow / activation). */
export async function GET(_request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("read");
  if (!authGate.ok) return authGate.response;

  const { quoteVersionId } = await context.params;

  try {
    const model = await getQuoteVersionLifecycleReadModel(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      quoteVersionId,
    });

    if (!model) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Quote version not found for tenant" } },
        { status: 404 },
      );
    }

    return NextResponse.json({
      data: toQuoteVersionLifecycleApiDto(model),
      meta: apiAuthMeta(authGate.principal),
    });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
