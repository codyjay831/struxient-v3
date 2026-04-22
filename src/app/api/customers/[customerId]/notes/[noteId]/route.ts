import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";
import { type UpdateCustomerNoteInput, updateCustomerNoteForTenant } from "@/server/slice1/mutations/customer-note-mutations";

type RouteContext = { params: Promise<{ customerId: string; noteId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  const { customerId, noteId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "INVALID_JSON", message: "Body must be JSON." } }, { status: 400 });
  }
  const o = body !== null && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};

  const patch: UpdateCustomerNoteInput = {
    tenantId: authGate.principal.tenantId,
    customerId,
    noteId,
    actorUserId: authGate.principal.userId,
  };
  if (typeof o.body === "string") patch.body = o.body;
  if (typeof o.archived === "boolean") patch.archived = o.archived;

  if (patch.body === undefined && patch.archived === undefined) {
    return NextResponse.json(
      { error: { code: "INVALID_BODY", message: "Provide body and/or archived." } },
      { status: 400 },
    );
  }

  try {
    const result = await updateCustomerNoteForTenant(getPrisma(), patch);
    if (result === "not_found") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Note not found for this customer." } },
        { status: 404 },
      );
    }
    return NextResponse.json({ data: { note: result }, meta: apiAuthMeta(authGate.principal) });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
