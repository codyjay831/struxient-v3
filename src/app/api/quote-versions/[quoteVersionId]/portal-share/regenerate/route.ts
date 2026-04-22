import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";
import { regenerateQuotePortalShareTokenForTenant } from "@/server/slice1/mutations/regenerate-quote-portal-share-token";

type RouteContext = { params: Promise<{ quoteVersionId: string }> };

/** Rotates `portalQuoteShareToken` for a **SENT** quote version (invalidates old customer links). */
export async function POST(_request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  const { quoteVersionId } = await context.params;

  try {
    const result = await regenerateQuotePortalShareTokenForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      quoteVersionId,
      actorUserId: authGate.principal.userId,
    });

    if (!result.ok) {
      if (result.kind === "not_found") {
        return NextResponse.json({ error: { code: "NOT_FOUND", message: "Quote version not found." } }, { status: 404 });
      }
      if (result.kind === "not_sent") {
        return NextResponse.json(
          { error: { code: "QUOTE_NOT_SENT", message: "Regeneration is only allowed while the version is SENT." } },
          { status: 409 },
        );
      }
      if (result.kind === "no_portal_token") {
        return NextResponse.json(
          { error: { code: "NO_PORTAL_TOKEN", message: "No portal token exists for this version." } },
          { status: 409 },
        );
      }
      if (result.kind === "invalid_actor") {
        return NextResponse.json({ error: { code: "INVALID_ACTOR", message: "User not valid for tenant." } }, { status: 403 });
      }
    }

    if (!result.ok) throw new Error("Unexpected regenerate result");

    return NextResponse.json({
      data: result.data,
      meta: apiAuthMeta(authGate.principal),
    });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
