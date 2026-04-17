import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { createNextQuoteVersionForTenant } from "@/server/slice1/mutations/create-next-quote-version";
import { getQuoteVersionHistoryForTenant } from "@/server/slice1/reads/quote-version-history-reads";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";

type RouteContext = { params: Promise<{ quoteId: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("read");
  if (!authGate.ok) return authGate.response;

  const { quoteId } = await context.params;

  try {
    const data = await getQuoteVersionHistoryForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      quoteId,
    });

    if (!data) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Quote not found for tenant" } },
        { status: 404 },
      );
    }

    return NextResponse.json({
      data,
      meta: apiAuthMeta(authGate.principal),
    });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}

export async function POST(_request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  const { quoteId } = await context.params;

  try {
    let result: Awaited<ReturnType<typeof createNextQuoteVersionForTenant>>;
    try {
      result = await createNextQuoteVersionForTenant(getPrisma(), {
        tenantId: authGate.principal.tenantId,
        quoteId,
        createdByUserId: authGate.principal.userId,
      });
    } catch (e) {
      if (e instanceof Error && e.message === "CREATED_BY_NOT_IN_TENANT") {
        return NextResponse.json(
          { error: { code: "INVALID_ACTOR", message: "Authenticated user is not a valid actor for this tenant." } },
          { status: 400 },
        );
      }
      throw e;
    }

    if (!result.ok) {
      switch (result.kind) {
        case "quote_not_found":
          return NextResponse.json(
            { error: { code: "NOT_FOUND", message: "Quote not found for tenant" } },
            { status: 404 },
          );
        case "no_source_version":
          return NextResponse.json(
            {
              error: {
                code: "NO_SOURCE_VERSION",
                message: "Quote has no existing versions to clone from.",
              },
            },
            { status: 422 },
          );
        case "version_number_conflict":
          return NextResponse.json(
            {
              error: {
                code: "VERSION_NUMBER_CONFLICT",
                message: "Version number collision; retry.",
              },
            },
            { status: 409 },
          );
        default: {
          const _ex: never = result;
          return _ex;
        }
      }
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
