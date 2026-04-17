import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { getCustomerForTenant } from "@/server/slice1/reads/customer-reads";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";

type RouteContext = { params: Promise<{ customerId: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("read");
  if (!authGate.ok) return authGate.response;

  const { customerId } = await context.params;

  try {
    const item = await getCustomerForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      customerId,
    });

    if (!item) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Customer not found for tenant" } },
        { status: 404 },
      );
    }

    return NextResponse.json({
      data: item,
      meta: apiAuthMeta(authGate.principal),
    });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
