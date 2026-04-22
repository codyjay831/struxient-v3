import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";
import { createCustomerContactMethodForTenant } from "@/server/slice1/mutations/customer-contact-mutations";
import { parseCustomerContactMethodType } from "@/server/slice1/mutations/customer-contact-method-type";

type RouteContext = { params: Promise<{ customerId: string; contactId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
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

  let type;
  try {
    type = parseCustomerContactMethodType(o.type);
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }

  const value = o.value;
  if (typeof value !== "string") {
    return NextResponse.json(
      { error: { code: "CUSTOMER_CONTACT_METHOD_VALUE_INVALID", message: "value (string) is required." } },
      { status: 400 },
    );
  }

  try {
    const result = await createCustomerContactMethodForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      customerId,
      contactId,
      actorUserId: authGate.principal.userId,
      type,
      value,
      isPrimary: o.isPrimary === true,
      okToSms: o.okToSms === true,
      okToEmail: o.okToEmail === true,
    });
    if (result === "not_found") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Contact not found or archived for this customer." } },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { data: { method: result }, meta: apiAuthMeta(authGate.principal) },
      { status: 201 },
    );
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
