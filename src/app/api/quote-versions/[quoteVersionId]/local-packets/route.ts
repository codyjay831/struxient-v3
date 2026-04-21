import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import {
  listQuoteLocalPacketsForVersion,
} from "@/server/slice1/reads/quote-local-packet-reads";
import { createQuoteLocalPacketForTenant } from "@/server/slice1/mutations/quote-local-packet-mutations";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import {
  apiAuthMeta,
  requireApiPrincipal,
  requireApiPrincipalWithCapability,
} from "@/lib/auth/api-principal";

type RouteContext = { params: Promise<{ quoteVersionId: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipal();
  if (!authGate.ok) return authGate.response;

  const { quoteVersionId } = await context.params;
  try {
    const data = await listQuoteLocalPacketsForVersion(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      quoteVersionId,
    });
    return NextResponse.json({ data, meta: apiAuthMeta(authGate.principal) });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  const { quoteVersionId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Request body must be JSON" } },
      { status: 400 },
    );
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { error: { code: "INVALID_BODY", message: "Body must be an object" } },
      { status: 400 },
    );
  }
  const o = body as Record<string, unknown>;

  try {
    const result = await createQuoteLocalPacketForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      quoteVersionId,
      userId: authGate.principal.userId,
      displayName: o.displayName,
      description: o.description,
    });
    if (result === "not_found") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Quote version not found in this tenant" } },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { data: result, meta: apiAuthMeta(authGate.principal) },
      { status: 201 },
    );
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
