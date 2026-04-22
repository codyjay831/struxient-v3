import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";
import {
  voidQuoteVersionForTenant,
  type VoidQuoteVersionRequestBody,
} from "@/server/slice1/mutations/void-quote-version-for-tenant";

type RouteContext = { params: Promise<{ quoteVersionId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  const { quoteVersionId } = await context.params;

  let body: VoidQuoteVersionRequestBody | null = null;
  const ct = request.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    try {
      const raw = (await request.json()) as Record<string, unknown>;
      if (typeof raw.voidReason === "string") {
        body = { voidReason: raw.voidReason };
      }
    } catch {
      return NextResponse.json(
        { error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } },
        { status: 400 },
      );
    }
  }

  if (!body) {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "voidReason (string) is required." } },
      { status: 400 },
    );
  }

  try {
    const result = await voidQuoteVersionForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      quoteVersionId,
      voidedByUserId: authGate.principal.userId,
      request: body,
    });

    if (!result.ok) {
      if (result.kind === "not_found") {
        return NextResponse.json({ error: { code: "NOT_FOUND", message: "Quote version not found." } }, { status: 404 });
      }
      if (result.kind === "invalid_actor") {
        return NextResponse.json({ error: { code: "INVALID_ACTOR", message: "Actor not valid for tenant." } }, { status: 403 });
      }
      if (result.kind === "invalid_body") {
        return NextResponse.json({ error: { code: "INVALID_REQUEST", message: result.message } }, { status: 400 });
      }
      if (result.kind === "already_void") {
        return NextResponse.json({ error: { code: "ALREADY_VOID", message: "This version is already void." } }, { status: 409 });
      }
      if (result.kind === "not_voidable_signed") {
        return NextResponse.json(
          {
            error: {
              code: "NOT_VOIDABLE_SIGNED",
              message: "Signed versions cannot be voided here; use post-activation change-order policy when execution exists.",
            },
          },
          { status: 409 },
        );
      }
      if (result.kind === "not_voidable_activated") {
        return NextResponse.json(
          { error: { code: "NOT_VOIDABLE_ACTIVATED", message: "Activated versions cannot be voided." } },
          { status: 409 },
        );
      }
      if (result.kind === "not_voidable_superseded") {
        return NextResponse.json(
          { error: { code: "NOT_VOIDABLE_SUPERSEDED", message: "Superseded revisions are historical only." } },
          { status: 409 },
        );
      }
      if (result.kind === "draft_only_version") {
        return NextResponse.json(
          {
            error: {
              code: "DRAFT_ONLY_VERSION",
              message: "Cannot void the only remaining revision; create another version first.",
            },
          },
          { status: 409 },
        );
      }
    }

    if (!result.ok) throw new Error("Unexpected void result");

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
