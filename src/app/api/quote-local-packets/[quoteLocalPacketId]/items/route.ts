import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { createQuoteLocalPacketItemForTenant } from "@/server/slice1/mutations/quote-local-packet-mutations";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";

type RouteContext = { params: Promise<{ quoteLocalPacketId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  const { quoteLocalPacketId } = await context.params;

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
    const result = await createQuoteLocalPacketItemForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      quoteLocalPacketId,
      userId: authGate.principal.userId,
      lineKey: o.lineKey,
      sortOrder: o.sortOrder,
      tierCode: o.tierCode,
      lineKind: o.lineKind,
      embeddedPayloadJson: o.embeddedPayloadJson,
      taskDefinitionId: o.taskDefinitionId,
      targetNodeKey: o.targetNodeKey,
    });
    if (result === "not_found") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "QuoteLocalPacket not found in this tenant" } },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { data: result, meta: apiAuthMeta(authGate.principal) },
      { status: 201 },
    );
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
