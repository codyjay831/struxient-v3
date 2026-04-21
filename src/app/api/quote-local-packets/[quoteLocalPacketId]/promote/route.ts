import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { promoteQuoteLocalPacketToCatalogForTenant } from "@/server/slice1/mutations/promote-quote-local-packet";
import { getQuoteLocalPacketForTenant } from "@/server/slice1/reads/quote-local-packet-reads";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";

/**
 * POST /api/quote-local-packets/[quoteLocalPacketId]/promote
 *
 * Interim one-step promotion: creates a new ScopePacket + first DRAFT
 * ScopePacketRevision and copies all items as PacketTaskLine rows. Source packet
 * becomes promotionStatus = COMPLETED with promotedScopePacketId set.
 *
 * Body:
 *   { packetKey: string, displayName?: string }
 *
 * No admin-review states are written. Refer to:
 *   - docs/canon/05-packet-canon.md
 *   - docs/implementation/decision-packs/interim-packet-promotion-decision-pack.md
 */
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
    const prisma = getPrisma();
    const result = await promoteQuoteLocalPacketToCatalogForTenant(prisma, {
      tenantId: authGate.principal.tenantId,
      quoteLocalPacketId,
      userId: authGate.principal.userId,
      packetKey: o.packetKey,
      ...(o.displayName !== undefined ? { displayName: o.displayName } : {}),
    });
    if (result === "not_found") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "QuoteLocalPacket not found in this tenant" } },
        { status: 404 },
      );
    }

    // Refresh the source packet DTO so the editor can render the promoted state
    // alongside the destination summary in a single response.
    const refreshed = await getQuoteLocalPacketForTenant(prisma, {
      tenantId: authGate.principal.tenantId,
      quoteLocalPacketId,
    });

    return NextResponse.json(
      {
        data: {
          promotion: result,
          quoteLocalPacket: refreshed,
        },
        meta: apiAuthMeta(authGate.principal),
      },
      { status: 201 },
    );
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
