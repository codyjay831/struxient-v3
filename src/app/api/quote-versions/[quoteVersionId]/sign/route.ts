import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { nextResponseForActivateQuoteFailure } from "@/lib/api/activate-quote-failure-response";
import { AutoActivateAfterSignError } from "@/server/slice1/mutations/activate-quote-version";
import { signQuoteVersionForTenant } from "@/server/slice1/mutations/sign-quote-version";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";

type RouteContext = { params: Promise<{ quoteVersionId: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  const { quoteVersionId } = await context.params;

  try {
    const result = await signQuoteVersionForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      quoteVersionId,
      recordedByUserId: authGate.principal.userId,
    });

    if (result.ok === false && result.kind === "not_found") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Quote version not found for tenant" } },
        { status: 404 },
      );
    }

    if (result.ok === false && result.kind === "invalid_recorded_by") {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_RECORDED_BY_USER",
            message: "Authenticated user is not a valid actor for this tenant.",
          },
        },
        { status: 400 },
      );
    }

    if (result.ok === false && result.kind === "not_sent") {
      return NextResponse.json(
        {
          error: {
            code: "QUOTE_VERSION_NOT_SENT",
            message: "Quote version must be SENT before sign; current status is " + result.status + ".",
          },
        },
        { status: 409 },
      );
    }

    if (result.ok === false && result.kind === "signed_state_inconsistent") {
      return NextResponse.json(
        {
          error: {
            code: "SIGNED_STATE_INCONSISTENT",
            message: "Version is SIGNED but signature or job row is missing; repair data manually.",
          },
        },
        { status: 500 },
      );
    }

    if (!result.ok) {
      throw new Error("Unexpected sign result");
    }

    return NextResponse.json({
      data: result.data,
      meta: apiAuthMeta(authGate.principal),
    });
  } catch (e) {
    if (e instanceof AutoActivateAfterSignError) {
      const inner = nextResponseForActivateQuoteFailure(e.activationFailure);
      const actBody = (await inner.json()) as { error: unknown };
      return NextResponse.json(
        {
          error: {
            code: "SIGN_ROLLED_BACK_AUTO_ACTIVATE_FAILED",
            message:
              "Tenant has autoActivateOnSign enabled; the transaction was rolled back because activation failed. Resolve activation errors and retry sign.",
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
