import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";
import { listQuotePortalShareDeliveriesForTenant } from "@/server/slice1/reads/quote-portal-share-reads";

type RouteContext = { params: Promise<{ quoteVersionId: string }> };

/** Recent portal-link delivery attempts for office visibility (Epic 54 follow-up). */
export async function GET(_request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("read");
  if (!authGate.ok) return authGate.response;

  const { quoteVersionId } = await context.params;

  try {
    const exists = await getPrisma().quoteVersion.findFirst({
      where: { id: quoteVersionId, quote: { tenantId: authGate.principal.tenantId } },
      select: { id: true },
    });
    if (!exists) {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "Quote version not found." } }, { status: 404 });
    }

    const items = await listQuotePortalShareDeliveriesForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      quoteVersionId,
    });

    return NextResponse.json({
      data: { deliveries: items },
      meta: apiAuthMeta(authGate.principal),
    });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
