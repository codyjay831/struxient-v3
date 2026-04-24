import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { declineQuoteVersionViaPortalShareToken } from "@/server/slice1/mutations/decline-quote-version-via-portal";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";

type RouteContext = { params: Promise<{ shareToken: string }> };

/**
 * Unauthenticated customer decline for a **sent** quote version (Epic 13 + 54).
 * Authorized only by `QuoteVersion.portalQuoteShareToken` (issued on send).
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { shareToken } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "INVALID_JSON", message: "Request body must be JSON." } }, { status: 400 });
  }

  const o = body as Record<string, unknown>;
  const declineReason = o.declineReason;
  if (typeof declineReason !== "string") {
    return NextResponse.json(
      { error: { code: "INVALID_BODY", message: "declineReason (string) is required." } },
      { status: 400 },
    );
  }

  try {
    const result = await declineQuoteVersionViaPortalShareToken(getPrisma(), {
      shareToken,
      request: { declineReason },
    });

    if (result.ok === false && result.kind === "not_found") {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "Invalid or unknown quote link." } }, { status: 404 });
    }

    if (result.ok === false && result.kind === "invalid_body") {
      return NextResponse.json({ error: { code: "INVALID_BODY", message: result.message } }, { status: 400 });
    }

    if (result.ok === false && result.kind === "not_sent") {
      return NextResponse.json(
        {
          error: {
            code: "QUOTE_NOT_DECLINABLE",
            message: "This quote is not open for decline in its current state.",
            status: result.status,
          },
        },
        { status: 409 },
      );
    }

    if (result.ok === false && result.kind === "declined_state_inconsistent") {
      return NextResponse.json(
        { error: { code: "DECLINED_STATE_INCONSISTENT", message: "Quote data is inconsistent; contact support." } },
        { status: 500 },
      );
    }

    if (!result.ok) {
      throw new Error("Unexpected portal decline result");
    }

    return NextResponse.json({ data: result.data });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
