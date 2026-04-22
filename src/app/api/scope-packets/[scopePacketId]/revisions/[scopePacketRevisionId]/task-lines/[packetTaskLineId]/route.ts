import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { deletePacketTaskLineForLibraryDraftRevision } from "@/server/slice1/mutations/packet-task-line-library-mutations";
import { getScopePacketRevisionDetailForTenant } from "@/server/slice1/reads/scope-packet-catalog-reads";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";

/**
 * DELETE …/task-lines/[packetTaskLineId] — remove a line from a **DRAFT** revision (`office_mutate`).
 */
type RouteContext = {
  params: Promise<{ scopePacketId: string; scopePacketRevisionId: string; packetTaskLineId: string }>;
};

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  const { scopePacketId, scopePacketRevisionId, packetTaskLineId } = await context.params;

  try {
    const prisma = getPrisma();
    const result = await deletePacketTaskLineForLibraryDraftRevision(prisma, {
      tenantId: authGate.principal.tenantId,
      userId: authGate.principal.userId,
      scopePacketId,
      scopePacketRevisionId,
      packetTaskLineId,
    });

    if (result === "not_found") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Packet task line not found on this revision." } },
        { status: 404 },
      );
    }

    const detail = await getScopePacketRevisionDetailForTenant(prisma, {
      tenantId: authGate.principal.tenantId,
      scopePacketId,
      scopePacketRevisionId,
    });

    return NextResponse.json({
      data: { deleted: true, scopePacketRevisionDetail: detail },
      meta: apiAuthMeta(authGate.principal),
    });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
