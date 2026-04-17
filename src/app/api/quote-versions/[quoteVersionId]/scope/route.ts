import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { getQuoteVersionScopeReadModel } from "@/server/slice1/reads/quote-version-scope";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";
import { toQuoteVersionScopeApiDto } from "@/lib/quote-version-scope-dto";

type RouteContext = { params: Promise<{ quoteVersionId: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("read");
  if (!authGate.ok) return authGate.response;

  const { quoteVersionId } = await context.params;

  try {
    const model = await getQuoteVersionScopeReadModel(getPrisma(), {
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
      data: toQuoteVersionScopeApiDto(model),
      meta: apiAuthMeta(authGate.principal),
    });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
