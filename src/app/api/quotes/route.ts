import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { clampQuoteShellListLimit, listCommercialQuoteShellsForTenant } from "@/server/slice1/reads/commercial-quote-shell-reads";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";

export async function GET(request: NextRequest) {
  const authGate = await requireApiPrincipalWithCapability("read");
  if (!authGate.ok) return authGate.response;

  const limit = clampQuoteShellListLimit(request.nextUrl.searchParams.get("limit"));

  try {
    const items = await listCommercialQuoteShellsForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      limit,
    });

    return NextResponse.json({
      data: { items, limit },
      meta: apiAuthMeta(authGate.principal),
    });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
