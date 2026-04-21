import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import {
  updateQuoteLocalPacketItemForTenant,
  deleteQuoteLocalPacketItemForTenant,
} from "@/server/slice1/mutations/quote-local-packet-mutations";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";

type RouteContext = { params: Promise<{ quoteLocalPacketId: string; itemId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  const { quoteLocalPacketId, itemId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Request body must be JSON" } },
      { status: 400 },
    );
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { error: { code: "INVALID_BODY", message: "Body must be an object" } },
      { status: 400 },
    );
  }
  const o = body as Record<string, unknown>;

  try {
    const result = await updateQuoteLocalPacketItemForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      quoteLocalPacketId,
      itemId,
      userId: authGate.principal.userId,
      ...(o.lineKey !== undefined ? { lineKey: o.lineKey } : {}),
      ...(o.sortOrder !== undefined ? { sortOrder: o.sortOrder } : {}),
      ...(o.tierCode !== undefined ? { tierCode: o.tierCode } : {}),
      ...(o.lineKind !== undefined ? { lineKind: o.lineKind } : {}),
      ...(o.embeddedPayloadJson !== undefined
        ? { embeddedPayloadJson: o.embeddedPayloadJson }
        : {}),
      ...(o.taskDefinitionId !== undefined ? { taskDefinitionId: o.taskDefinitionId } : {}),
      ...(o.targetNodeKey !== undefined ? { targetNodeKey: o.targetNodeKey } : {}),
    });
    if (result === "not_found") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "QuoteLocalPacket not found in this tenant" } },
        { status: 404 },
      );
    }
    return NextResponse.json({ data: result, meta: apiAuthMeta(authGate.principal) });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  const { quoteLocalPacketId, itemId } = await context.params;

  try {
    const result = await deleteQuoteLocalPacketItemForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      quoteLocalPacketId,
      itemId,
      userId: authGate.principal.userId,
    });
    if (result === "not_found") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "QuoteLocalPacket not found in this tenant" } },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { data: { deleted: true }, meta: apiAuthMeta(authGate.principal) },
    );
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
