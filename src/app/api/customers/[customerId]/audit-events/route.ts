import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";
import { listCustomerAuditEventsForTenant } from "@/server/slice1/reads/customer-audit-reads";

type RouteContext = { params: Promise<{ customerId: string }> };

/** Tenant-scoped **system** audit tail for a customer (Epic 57); excludes note bodies. */
export async function GET(_request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("read");
  if (!authGate.ok) return authGate.response;

  const { customerId } = await context.params;

  try {
    const items = await listCustomerAuditEventsForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      customerId,
    });
    if (items === null) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Customer not found for tenant." } },
        { status: 404 },
      );
    }
    return NextResponse.json({
      data: { events: items },
      meta: apiAuthMeta(authGate.principal),
    });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
