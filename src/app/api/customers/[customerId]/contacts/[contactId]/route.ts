import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";
import {
  type UpdateCustomerContactInput,
  updateCustomerContactForTenant,
} from "@/server/slice1/mutations/customer-contact-mutations";

type RouteContext = { params: Promise<{ customerId: string; contactId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  const { customerId, contactId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "INVALID_JSON", message: "Body must be JSON." } }, { status: 400 });
  }
  const o = body !== null && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};

  const patch: UpdateCustomerContactInput = {
    tenantId: authGate.principal.tenantId,
    customerId,
    contactId,
  };
  if (typeof o.displayName === "string") patch.displayName = o.displayName;
  if ("role" in o) patch.role = o.role;
  if (typeof o.notes === "string" || o.notes === null) patch.notes = o.notes as string | null;
  if (typeof o.archived === "boolean") patch.archived = o.archived;

  if (
    patch.displayName === undefined &&
    patch.role === undefined &&
    patch.notes === undefined &&
    patch.archived === undefined
  ) {
    return NextResponse.json(
      { error: { code: "INVALID_BODY", message: "Provide at least one of displayName, role, notes, archived." } },
      { status: 400 },
    );
  }

  try {
    const result = await updateCustomerContactForTenant(getPrisma(), patch);
    if (result === "not_found") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Contact not found for this customer." } },
        { status: 404 },
      );
    }
    return NextResponse.json({ data: { contact: result }, meta: apiAuthMeta(authGate.principal) });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
