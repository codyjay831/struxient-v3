import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { publishScopePacketRevisionForTenant } from "@/server/slice1/mutations/publish-scope-packet-revision";
import { getScopePacketRevisionDetailForTenant } from "@/server/slice1/reads/scope-packet-catalog-reads";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";

/**
 * POST /api/scope-packets/[scopePacketId]/revisions/[scopePacketRevisionId]/publish
 *
 * Interim publish action: transitions a DRAFT ScopePacketRevision to PUBLISHED,
 * setting `publishedAt = NOW()` atomically. Mandatory preflight: tenant
 * ownership, status === DRAFT, readiness predicate isReady, no other PUBLISHED
 * sibling revision under the same packet.
 *
 * Body: none required. (Reserved as `{}` so a future `confirm` token or
 * client-side optimistic concurrency hint can be added without a route change.)
 *
 * No admin-review states are written. No `catalog.publish` capability exists
 * yet; `office_mutate` is the interim authority. See:
 *   - docs/canon/05-packet-canon.md ("Canon amendment — interim publish authority")
 *   - docs/implementation/decision-packs/interim-publish-authority-decision-pack.md
 */
type RouteContext = {
  params: Promise<{ scopePacketId: string; scopePacketRevisionId: string }>;
};

export async function POST(_request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  const { scopePacketId, scopePacketRevisionId } = await context.params;

  try {
    const prisma = getPrisma();
    const result = await publishScopePacketRevisionForTenant(prisma, {
      tenantId: authGate.principal.tenantId,
      scopePacketId,
      scopePacketRevisionId,
      userId: authGate.principal.userId,
    });
    if (result === "not_found") {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message:
              "ScopePacketRevision not found in this tenant or does not belong to the supplied packet.",
          },
        },
        { status: 404 },
      );
    }

    // Refresh the full revision detail DTO so the inspector page can render
    // the new PUBLISHED state (including `publishedAtIso` and the now-trivial
    // readiness panel) in a single round trip.
    const refreshed = await getScopePacketRevisionDetailForTenant(prisma, {
      tenantId: authGate.principal.tenantId,
      scopePacketId,
      scopePacketRevisionId,
    });

    return NextResponse.json(
      {
        data: {
          publish: result,
          scopePacketRevisionDetail: refreshed,
        },
        meta: apiAuthMeta(authGate.principal),
      },
      { status: 200 },
    );
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
