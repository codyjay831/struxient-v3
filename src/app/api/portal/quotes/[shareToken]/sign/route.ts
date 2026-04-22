import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { nextResponseForActivateQuoteFailure } from "@/lib/api/activate-quote-failure-response";
import { AutoActivateAfterSignError } from "@/server/slice1/mutations/activate-quote-version";
import { signQuoteVersionViaPortalShareToken } from "@/server/slice1/mutations/sign-quote-version-via-portal";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";

type RouteContext = { params: Promise<{ shareToken: string }> };

/**
 * Unauthenticated customer acceptance for a **sent** quote version (Epic 54).
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
  const signerName = o.signerName;
  const signerEmail = o.signerEmail;
  const acceptTerms = o.acceptTerms;
  if (typeof signerName !== "string" || typeof signerEmail !== "string" || typeof acceptTerms !== "boolean") {
    return NextResponse.json(
      { error: { code: "INVALID_BODY", message: "signerName, signerEmail (strings), and acceptTerms (boolean) are required." } },
      { status: 400 },
    );
  }

  try {
    const result = await signQuoteVersionViaPortalShareToken(getPrisma(), {
      shareToken,
      request: { signerName, signerEmail, acceptTerms },
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
            code: "QUOTE_NOT_ACCEPTABLE",
            message: "This quote is not open for acceptance in its current state.",
            status: result.status,
          },
        },
        { status: 409 },
      );
    }

    if (result.ok === false && result.kind === "signed_state_inconsistent") {
      return NextResponse.json(
        { error: { code: "SIGNED_STATE_INCONSISTENT", message: "Quote data is inconsistent; contact support." } },
        { status: 500 },
      );
    }

    if (!result.ok) {
      throw new Error("Unexpected portal sign result");
    }

    return NextResponse.json({ data: result.data });
  } catch (e) {
    if (e instanceof AutoActivateAfterSignError) {
      const inner = nextResponseForActivateQuoteFailure(e.activationFailure);
      const actBody = (await inner.json()) as { error: unknown };
      return NextResponse.json(
        {
          error: {
            code: "SIGN_ROLLED_BACK_AUTO_ACTIVATE_FAILED",
            message:
              "Activation after sign failed; the transaction was rolled back. Please contact your project office.",
            activation: actBody.error,
          },
        },
        { status: inner.status },
      );
    }
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
