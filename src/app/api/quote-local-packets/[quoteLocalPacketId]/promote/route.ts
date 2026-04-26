import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { promoteQuoteLocalPacketToCatalogForTenant } from "@/server/slice1/mutations/promote-quote-local-packet";
import { promoteQuoteLocalPacketIntoExistingScopePacketForTenant } from "@/server/slice1/mutations/promote-quote-local-packet-into-existing";
import { getQuoteLocalPacketForTenant } from "@/server/slice1/reads/quote-local-packet-reads";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";

/**
 * POST /api/quote-local-packets/[quoteLocalPacketId]/promote
 *
 * Promotes a `QuoteLocalPacket` into a catalog `ScopePacket`. Two mutually
 * exclusive request shapes are accepted; the route dispatches to the
 * matching mutation:
 *
 *   1. Promote into a NEW saved packet (interim one-step flow):
 *        { packetKey: string, displayName?: string }
 *      Creates a new ScopePacket + first DRAFT ScopePacketRevision and
 *      copies all items as PacketTaskLine rows.
 *
 *   2. Promote into an EXISTING saved packet as the next DRAFT revision:
 *        { targetScopePacketId: string }
 *      Creates a new DRAFT ScopePacketRevision (revisionNumber = max + 1)
 *      on the target packet and copies all items as PacketTaskLine rows.
 *      Refused with `..._TARGET_HAS_DRAFT` if the target already has a
 *      DRAFT revision (single-DRAFT canon §4).
 *
 * Both paths share the same source-side lifecycle: the source packet must
 * be `promotionStatus = NONE` and transitions to `COMPLETED` with
 * `promotedScopePacketId` populated. Either path can therefore only run
 * once per source packet.
 *
 * Refer to:
 *   - docs/canon/05-packet-canon.md
 *   - docs/implementation/decision-packs/interim-packet-promotion-decision-pack.md
 *   - docs/implementation/decision-packs/revision-2-evolution-decision-pack.md
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

  // Dispatch on body shape. The two paths are mutually exclusive — sending
  // both targetScopePacketId AND packetKey (or neither) is a validation
  // error, since "promote to new" vs "promote into existing" are distinct
  // user intents and we don't want to silently pick one for the caller.
  const wantsExisting = typeof o.targetScopePacketId === "string";
  const wantsNew = typeof o.packetKey === "string";

  if (wantsExisting && wantsNew) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_BODY",
          message:
            "Provide either { packetKey } to create a new saved template, or { targetScopePacketId } to add a new draft to an existing saved template — not both.",
        },
      },
      { status: 400 },
    );
  }
  if (!wantsExisting && !wantsNew) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_BODY",
          message:
            "Body must contain either { packetKey } (promote to a new saved template) or { targetScopePacketId } (promote into an existing saved template).",
        },
      },
      { status: 400 },
    );
  }

  try {
    const prisma = getPrisma();
    const result = wantsExisting
      ? await promoteQuoteLocalPacketIntoExistingScopePacketForTenant(prisma, {
          tenantId: authGate.principal.tenantId,
          quoteLocalPacketId,
          targetScopePacketId: o.targetScopePacketId as string,
          userId: authGate.principal.userId,
        })
      : await promoteQuoteLocalPacketToCatalogForTenant(prisma, {
          tenantId: authGate.principal.tenantId,
          quoteLocalPacketId,
          userId: authGate.principal.userId,
          packetKey: o.packetKey,
          ...(o.displayName !== undefined ? { displayName: o.displayName } : {}),
        });
    if (result === "not_found") {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: wantsExisting
              ? "QuoteLocalPacket or target ScopePacket not found in this tenant"
              : "QuoteLocalPacket not found in this tenant",
          },
        },
        { status: 404 },
      );
    }

    // Refresh the source packet DTO so the editor can render the promoted
    // state alongside the destination summary in a single response.
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
