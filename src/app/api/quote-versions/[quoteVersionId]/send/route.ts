import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getPrisma } from "@/server/db/prisma";
import { sendQuoteVersionForTenant } from "@/server/slice1/mutations/send-quote-version";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";

type RouteContext = { params: Promise<{ quoteVersionId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  const { quoteVersionId } = await context.params;

  let body: {
    clientStalenessToken?: string | null;
    sendClientRequestId?: string | null;
  } = {};
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
    let result: Awaited<ReturnType<typeof sendQuoteVersionForTenant>>;
    try {
      result = await sendQuoteVersionForTenant(getPrisma(), {
        tenantId: authGate.principal.tenantId,
        quoteVersionId,
        sentByUserId: authGate.principal.userId,
        request: {
          clientStalenessToken: body.clientStalenessToken,
          sendClientRequestId: body.sendClientRequestId,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const meta = e.meta as { target?: string[] } | undefined;
        const target = meta?.target?.join(",") ?? "";
        if (target.includes("sendClientRequestId")) {
          return NextResponse.json(
            {
              error: {
                code: "SEND_CLIENT_REQUEST_ID_DUPLICATE",
                message:
                  "sendClientRequestId is already used by another quote version; choose a unique idempotency key.",
              },
            },
            { status: 409 },
          );
        }
      }
      throw e;
    }

    if (result.ok === false && result.kind === "not_found") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Quote version not found for tenant" } },
        { status: 404 },
      );
    }

    if (result.ok === false && result.kind === "idempotency_conflict") {
      return NextResponse.json({ error: { code: "QUOTE_VERSION_ALREADY_SENT", message: result.message } }, { status: 409 });
    }

    if (result.ok === false && result.kind === "stale_client_token") {
      return NextResponse.json(
        {
          error: {
            code: "SEND_STALE_CLIENT_TOKEN",
            message:
              "clientStalenessToken does not match composePreviewStalenessToken; run compose-preview and retry with a fresh token.",
            serverToken: result.serverToken,
            clientToken: result.clientToken,
          },
        },
        { status: 409 },
      );
    }

    if (result.ok === false && result.kind === "compose_blocked") {
      return NextResponse.json(
        { error: { code: "SEND_COMPOSE_BLOCKED", message: "Compose validation failed.", composeErrors: result.errors } },
        { status: 422 },
      );
    }

    if (result.ok === false && result.kind === "invalid_sent_by_user") {
      return NextResponse.json(
        { error: { code: "INVALID_ACTOR", message: "Authenticated user is not a valid actor for this tenant." } },
        { status: 400 },
      );
    }

    if (!result.ok) {
      throw new Error("Unexpected send result");
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
