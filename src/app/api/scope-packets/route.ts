import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { clampScopePacketListLimit } from "@/lib/scope-packet-catalog-summary";
import { listScopePacketsForTenant } from "@/server/slice1/reads/scope-packet-catalog-reads";
import { createGreenfieldScopePacketForTenant } from "@/server/slice1/mutations/create-greenfield-scope-packet-for-tenant";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";

export async function GET(request: NextRequest) {
  const authGate = await requireApiPrincipalWithCapability("read");
  if (!authGate.ok) return authGate.response;

  const limit = clampScopePacketListLimit(request.nextUrl.searchParams.get("limit"));

  try {
    const items = await listScopePacketsForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      limit,
    });
    return NextResponse.json({
      data: { items, limit },
      meta: apiAuthMeta(authGate.principal),
    });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}

/**
 * POST /api/scope-packets — greenfield catalog packet (Epic 15): new `ScopePacket` + first DRAFT revision (r1, empty).
 * Body: `{ displayName: string, packetKey?: string }`. When `packetKey` is omitted, a unique slug is derived from `displayName`.
 */
export async function POST(request: NextRequest) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "INVALID_JSON", message: "Body must be JSON." } }, { status: 400 });
  }
  const o = body !== null && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};

  try {
    const result = await createGreenfieldScopePacketForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      userId: authGate.principal.userId,
      displayName: o.displayName,
      packetKey: o.packetKey,
    });

    return NextResponse.json(
      {
        data: result,
        meta: apiAuthMeta(authGate.principal),
      },
      { status: 201 },
    );
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
