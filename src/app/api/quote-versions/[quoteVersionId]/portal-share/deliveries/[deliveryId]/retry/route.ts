import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";
import { retryQuotePortalShareDeliveryForTenant } from "@/server/slice1/mutations/quote-portal-share-delivery";

type RouteContext = { params: Promise<{ quoteVersionId: string; deliveryId: string }> };

/** Office retry for a failed quote-portal email/SMS delivery (Epic 56 — delivery hardening). */
export async function POST(request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  const { quoteVersionId, deliveryId } = await context.params;
  const origin = new URL(request.url).origin;

  try {
    const result = await retryQuotePortalShareDeliveryForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      quoteVersionId,
      deliveryId,
      actorUserId: authGate.principal.userId,
      baseUrl: origin,
    });

    if (!result.ok) {
      if (result.kind === "not_found") {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Delivery record not found for this quote version." } },
          { status: 404 },
        );
      }
      if (result.kind === "not_failed") {
        return NextResponse.json(
          { error: { code: "NOT_FAILED", message: "Only failed deliveries can be retried." } },
          { status: 409 },
        );
      }
      if (result.kind === "not_sent") {
        return NextResponse.json(
          { error: { code: "QUOTE_NOT_SENT", message: "Portal retry requires the quote version to remain SENT." } },
          { status: 409 },
        );
      }
      if (result.kind === "no_portal_token") {
        return NextResponse.json(
          {
            error: {
              code: "NO_PORTAL_TOKEN",
              message: "This version has no portal link token; regenerate the token before retrying delivery.",
            },
          },
          { status: 409 },
        );
      }
      if (result.kind === "missing_recipient") {
        return NextResponse.json(
          { error: { code: "MISSING_RECIPIENT", message: "This delivery row has no recipient to retry to." } },
          { status: 400 },
        );
      }
      if (result.kind === "invalid_actor") {
        return NextResponse.json(
          { error: { code: "INVALID_ACTOR", message: "Actor not found in tenant." } },
          { status: 403 },
        );
      }
    }

    if (!result.ok) {
      throw new Error("Unexpected retry result");
    }

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
