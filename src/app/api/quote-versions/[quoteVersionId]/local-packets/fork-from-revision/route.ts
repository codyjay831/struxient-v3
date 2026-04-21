import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { forkScopePacketRevisionToQuoteLocalForTenant } from "@/server/slice1/mutations/fork-scope-packet-revision-to-quote-local";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";

/**
 * POST /api/quote-versions/[quoteVersionId]/local-packets/fork-from-revision
 *
 * Interim quote-local fork from a PUBLISHED `ScopePacketRevision`. Deep-copies
 * every PacketTaskLine into a new QuoteLocalPacket on the target DRAFT quote
 * version with `originType = FORK_FROM_LIBRARY` and `forkedFromScopePacketRevisionId`
 * set. The source PUBLISHED revision is never touched.
 *
 * Body:
 *   - `scopePacketRevisionId: string` (required)
 *   - `displayName?: string` (optional override; defaults to the source
 *     ScopePacket.displayName)
 *
 * Out of scope (returns 4xx, never hidden coercions): catalog-side editing,
 * revision-2 / new-DRAFT creation, supersede, archive, auto-pin to a
 * QuoteLineItem, cross-tenant fork.
 *
 * Canon refs:
 *   - docs/canon/05-packet-canon.md §100-101
 *   - docs/bridge-decisions/03-packet-fork-promotion-decision.md
 */
type RouteContext = { params: Promise<{ quoteVersionId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  const { quoteVersionId } = await context.params;

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
  const scopePacketRevisionId = o.scopePacketRevisionId;
  if (typeof scopePacketRevisionId !== "string" || scopePacketRevisionId.trim().length === 0) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_BODY",
          message: "scopePacketRevisionId must be a non-empty string",
        },
      },
      { status: 400 },
    );
  }

  try {
    const result = await forkScopePacketRevisionToQuoteLocalForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      quoteVersionId,
      scopePacketRevisionId: scopePacketRevisionId.trim(),
      userId: authGate.principal.userId,
      displayName: o.displayName,
    });
    if (result === "not_found") {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message:
              "Source ScopePacketRevision and/or target QuoteVersion not found in this tenant.",
          },
        },
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
