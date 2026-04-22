import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";
import {
  deleteCustomerContactMethodForTenant,
  type UpdateCustomerContactMethodInput,
  updateCustomerContactMethodForTenant,
} from "@/server/slice1/mutations/customer-contact-mutations";

type RouteContext = { params: Promise<{ customerId: string; contactId: string; methodId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  const { customerId, contactId, methodId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "INVALID_JSON", message: "Body must be JSON." } }, { status: 400 });
  }
  const o = body !== null && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};

  const patch: UpdateCustomerContactMethodInput = {
    tenantId: authGate.principal.tenantId,
    customerId,
    contactId,
    methodId,
  };
  if (typeof o.value === "string") patch.value = o.value;
  if (typeof o.isPrimary === "boolean") patch.isPrimary = o.isPrimary;
  if (typeof o.okToSms === "boolean") patch.okToSms = o.okToSms;
  if (typeof o.okToEmail === "boolean") patch.okToEmail = o.okToEmail;

  if (
    patch.value === undefined &&
    patch.isPrimary === undefined &&
    patch.okToSms === undefined &&
    patch.okToEmail === undefined
  ) {
    return NextResponse.json(
      { error: { code: "INVALID_BODY", message: "Provide at least one of value, isPrimary, okToSms, okToEmail." } },
      { status: 400 },
    );
  }

  try {
    const result = await updateCustomerContactMethodForTenant(getPrisma(), patch);
    if (result === "not_found") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Contact or method not found." } },
        { status: 404 },
      );
    }
    return NextResponse.json({ data: { method: result }, meta: apiAuthMeta(authGate.principal) });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  const { customerId, contactId, methodId } = await context.params;

  try {
    const result = await deleteCustomerContactMethodForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      customerId,
      contactId,
      methodId,
    });
    if (result === "not_found") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Contact or method not found." } },
        { status: 404 },
      );
    }
    return NextResponse.json({ data: { deleted: true }, meta: apiAuthMeta(authGate.principal) });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
