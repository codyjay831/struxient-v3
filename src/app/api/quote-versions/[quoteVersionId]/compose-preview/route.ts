import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { buildComposePreviewResponse } from "@/server/slice1/compose-preview/build-compose-preview";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";

type RouteContext = { params: Promise<{ quoteVersionId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  const { quoteVersionId } = await context.params;

  let body: { clientStalenessToken?: string | null; acknowledgedWarningCodes?: string[] } = {};
  const ct = request.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json(
        { error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } },
        { status: 400 },
      );
    }
  }

  try {
    const result = await buildComposePreviewResponse(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      quoteVersionId,
      request: {
        clientStalenessToken: body.clientStalenessToken,
        acknowledgedWarningCodes: body.acknowledgedWarningCodes,
      },
    });

    if (result.ok === false && result.kind === "not_found") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Quote version not found for tenant" } },
        { status: 404 },
      );
    }

    if (result.ok === false && result.kind === "not_draft") {
      return NextResponse.json(
        {
          error: {
            code: "QUOTE_VERSION_NOT_DRAFT",
            message: "Compose preview is only available for DRAFT quote versions.",
          },
        },
        { status: 409 },
      );
    }

    if (result.ok === false && result.kind === "canonical_ensure_failed") {
      return NextResponse.json(
        {
          error: {
            code: "CANONICAL_WORKFLOW_ENSURE_FAILED",
            message: result.message,
          },
        },
        { status: 500 },
      );
    }

    if (!result.ok) {
      throw new Error("Unexpected compose preview result");
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
