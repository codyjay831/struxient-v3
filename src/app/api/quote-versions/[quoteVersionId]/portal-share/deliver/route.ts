import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { PublicShareDeliveryMethod } from "@prisma/client";
import { getPrisma } from "@/server/db/prisma";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";
import {
  sendQuotePortalShareForTenant,
  type SendQuotePortalShareRequestBody,
} from "@/server/slice1/mutations/quote-portal-share-delivery";

type RouteContext = { params: Promise<{ quoteVersionId: string }> };

const METHODS = new Set<string>(["EMAIL", "SMS", "MANUAL_LINK"]);

export async function POST(request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  const { quoteVersionId } = await context.params;

  let requestBody: SendQuotePortalShareRequestBody | null = null;
  const ct = request.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    try {
      const body = (await request.json()) as Record<string, unknown>;
      const method = body.method;
      const recipientDetail = body.recipientDetail;
      if (
        typeof method === "string" &&
        METHODS.has(method) &&
        typeof recipientDetail === "string"
      ) {
        const origin = new URL(request.url).origin;
        const baseUrl =
          typeof body.baseUrl === "string" && /^https?:\/\//i.test(body.baseUrl.trim())
            ? body.baseUrl.trim().replace(/\/$/, "")
            : origin;
        requestBody = {
          method: method as PublicShareDeliveryMethod,
          recipientDetail: recipientDetail.trim(),
          baseUrl,
          isFollowUp: Boolean(body.isFollowUp),
        };
      }
    } catch {
      return NextResponse.json(
        { error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } },
        { status: 400 },
      );
    }
  }

  if (!requestBody) {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "method and recipientDetail are required." } },
      { status: 400 },
    );
  }

  if (requestBody.method !== "MANUAL_LINK" && !requestBody.recipientDetail) {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "recipientDetail is required for EMAIL and SMS." } },
      { status: 400 },
    );
  }

  try {
    const result = await sendQuotePortalShareForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      quoteVersionId,
      actorUserId: authGate.principal.userId,
      request: requestBody,
    });

    if (!result.ok) {
      if (result.kind === "not_found") {
        return NextResponse.json({ error: { code: "NOT_FOUND", message: "Quote version not found." } }, { status: 404 });
      }
      if (result.kind === "not_sent") {
        return NextResponse.json(
          { error: { code: "QUOTE_NOT_SENT", message: "Portal delivery is only available for SENT versions." } },
          { status: 409 },
        );
      }
      if (result.kind === "no_portal_token") {
        return NextResponse.json(
          {
            error: {
              code: "NO_PORTAL_TOKEN",
              message: "This version has no portal link token; re-send the quote to mint one.",
            },
          },
          { status: 409 },
        );
      }
      if (result.kind === "invalid_actor") {
        return NextResponse.json({ error: { code: "INVALID_ACTOR", message: "User not valid for tenant." } }, { status: 403 });
      }
    }

    if (!result.ok) throw new Error("Unexpected delivery result");

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
