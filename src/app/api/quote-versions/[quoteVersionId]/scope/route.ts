import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { ensureDraftQuoteVersionPinnedToCanonicalForTenant } from "@/server/slice1/mutations/ensure-draft-quote-version-canonical-pin";
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
    const prisma = getPrisma();
    let model = await getQuoteVersionScopeReadModel(prisma, {
      tenantId: authGate.principal.tenantId,
      quoteVersionId,
    });

    if (!model) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Quote version not found for tenant" } },
        { status: 404 },
      );
    }

    if (model.status === "DRAFT") {
      const pin = await ensureDraftQuoteVersionPinnedToCanonicalForTenant(prisma, {
        tenantId: authGate.principal.tenantId,
        quoteVersionId,
      });
      if (!pin.ok) {
        if (pin.kind === "ensure_canonical_failed") {
          return NextResponse.json(
            {
              error: {
                code: "CANONICAL_WORKFLOW_ENSURE_FAILED",
                message: pin.message,
              },
            },
            { status: 500 },
          );
        }
      } else if (pin.repaired) {
        const again = await getQuoteVersionScopeReadModel(prisma, {
          tenantId: authGate.principal.tenantId,
          quoteVersionId,
        });
        if (again) model = again;
      }
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
