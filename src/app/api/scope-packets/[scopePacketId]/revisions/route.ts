import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { createDraftScopePacketRevisionFromPublishedForTenant } from "@/server/slice1/mutations/create-draft-scope-packet-revision-from-published";
import {
  getScopePacketDetailForTenant,
  getScopePacketRevisionDetailForTenant,
} from "@/server/slice1/reads/scope-packet-catalog-reads";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";

/**
 * POST /api/scope-packets/[scopePacketId]/revisions
 *
 * Create the next DRAFT `ScopePacketRevision` (revision N+1) as a deep clone
 * of the current PUBLISHED revision on the same packet.
 *
 * Body: none required (`{}` is reserved for a future "intent token" hint).
 *
 * Preflight (decision pack §3, §4): tenant ownership, at least one PUBLISHED
 * revision exists, no DRAFT revision exists, source PUBLISHED has at least one
 * `PacketTaskLine`. Failures map to 409 (state-conflicts) or 400 (empty source).
 *
 * Response includes the refreshed packet detail DTO so the inspector can
 * render the new DRAFT immediately, and the refreshed revision detail so the
 * client can navigate without a second round trip.
 *
 * `office_mutate` is the interim authority (no `catalog.publish` capability).
 *
 * Canon refs:
 *   - docs/canon/05-packet-canon.md ("Canon amendment — revision-2 evolution
 *     policy (post-publish)")
 *   - docs/implementation/decision-packs/revision-2-evolution-decision-pack.md
 */
type RouteContext = { params: Promise<{ scopePacketId: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  const { scopePacketId } = await context.params;

  try {
    const prisma = getPrisma();
    const result = await createDraftScopePacketRevisionFromPublishedForTenant(prisma, {
      tenantId: authGate.principal.tenantId,
      scopePacketId,
      userId: authGate.principal.userId,
    });
    if (result === "not_found") {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "ScopePacket not found in this tenant.",
          },
        },
        { status: 404 },
      );
    }

    // Refresh both the packet detail (so the inspector can re-render the
    // revisions list with the new DRAFT row in place) and the new revision's
    // detail (so the client can render the freshly cloned PacketTaskLine set
    // without a second round trip).
    const [packetDetail, revisionDetail] = await Promise.all([
      getScopePacketDetailForTenant(prisma, {
        tenantId: authGate.principal.tenantId,
        scopePacketId,
      }),
      getScopePacketRevisionDetailForTenant(prisma, {
        tenantId: authGate.principal.tenantId,
        scopePacketId,
        scopePacketRevisionId: result.newRevision.id,
      }),
    ]);

    return NextResponse.json(
      {
        data: {
          createDraftFromPublished: result,
          scopePacketDetail: packetDetail,
          scopePacketRevisionDetail: revisionDetail,
        },
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
