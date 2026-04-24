import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { requestQuoteChangesViaPortalShareToken } from "@/server/slice1/mutations/request-quote-changes-via-portal";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";

type RouteContext = { params: Promise<{ shareToken: string }> };

/**
 * Unauthenticated customer change request for a **sent** quote version (Epic 13 + 54).
 * Authorized only by `QuoteVersion.portalQuoteShareToken`. Version stays **SENT**.
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
  const message = o.message;
  if (typeof message !== "string") {
    return NextResponse.json(
      { error: { code: "INVALID_BODY", message: "message (string) is required." } },
      { status: 400 },
    );
  }

  try {
    const result = await requestQuoteChangesViaPortalShareToken(getPrisma(), {
      shareToken,
      request: { message },
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
            code: "QUOTE_NOT_CHANGE_REQUESTABLE",
            message: "This quote is not open for change requests in its current state.",
            status: result.status,
          },
        },
        { status: 409 },
      );
    }

    if (result.ok === false && result.kind === "sent_state_inconsistent") {
      return NextResponse.json(
        { error: { code: "SENT_STATE_INCONSISTENT", message: "Quote data is inconsistent; contact support." } },
        { status: 500 },
      );
    }

    if (!result.ok) {
      throw new Error("Unexpected portal change-request result");
    }

    return NextResponse.json({ data: result.data });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
