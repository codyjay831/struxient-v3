import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";
import { createCustomerNoteForTenant } from "@/server/slice1/mutations/customer-note-mutations";
import { listCustomerNotesForTenant } from "@/server/slice1/reads/customer-note-reads";

type RouteContext = { params: Promise<{ customerId: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("read");
  if (!authGate.ok) return authGate.response;

  const { customerId } = await context.params;

  try {
    const items = await listCustomerNotesForTenant(getPrisma(), {
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
      data: { notes: items },
      meta: apiAuthMeta(authGate.principal),
    });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  const { customerId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "INVALID_JSON", message: "Body must be JSON." } }, { status: 400 });
  }
  const o = body !== null && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const text = o.body;
  if (typeof text !== "string") {
    return NextResponse.json(
      { error: { code: "CUSTOMER_NOTE_BODY_INVALID", message: "body (string) is required." } },
      { status: 400 },
    );
  }

  try {
    const result = await createCustomerNoteForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      customerId,
      actorUserId: authGate.principal.userId,
      body: text,
    });
    if (result === "parent_not_found") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Customer not found for tenant." } },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { data: { note: result }, meta: apiAuthMeta(authGate.principal) },
      { status: 201 },
    );
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
