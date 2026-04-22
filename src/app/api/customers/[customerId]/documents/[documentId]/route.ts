import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";
import { archiveCustomerDocumentForTenant } from "@/server/slice1/mutations/customer-document-mutations";

type RouteContext = { params: Promise<{ customerId: string; documentId: string }> };

/** Archive a customer document (`{ "archived": true }`). Does not delete storage (Epic 06 retention). */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  const { customerId, documentId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "INVALID_JSON", message: "Body must be JSON." } }, { status: 400 });
  }
  const o = body !== null && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  if (o.archived !== true) {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: 'Set "archived": true to archive this document.' } },
      { status: 400 },
    );
  }

  try {
    const result = await archiveCustomerDocumentForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      customerId,
      documentId,
      actorUserId: authGate.principal.userId,
    });

    if (!result.ok) {
      if (result.kind === "not_found") {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Document not found for this customer." } },
          { status: 404 },
        );
      }
      if (result.kind === "already_archived") {
        return NextResponse.json(
          { error: { code: "ALREADY_ARCHIVED", message: "Document is already archived." } },
          { status: 409 },
        );
      }
      if (result.kind === "invalid_actor") {
        return NextResponse.json(
          { error: { code: "INVALID_ACTOR", message: "Actor not valid for tenant." } },
          { status: 403 },
        );
      }
    }

    return NextResponse.json({
      data: { id: result.ok ? result.id : null },
      meta: apiAuthMeta(authGate.principal),
    });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
