import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { createEmbeddedPacketTaskLineForLibraryDraftRevision } from "@/server/slice1/mutations/packet-task-line-library-mutations";
import { getScopePacketRevisionDetailForTenant } from "@/server/slice1/reads/scope-packet-catalog-reads";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";

/**
 * POST …/task-lines — add one **EMBEDDED** line to a **DRAFT** library revision (`office_mutate`).
 *
 * Body: `{ lineKey, targetNodeKey, title, taskKind?, tierCode?, sortOrder? }`.
 */
type RouteContext = {
  params: Promise<{ scopePacketId: string; scopePacketRevisionId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  const { scopePacketId, scopePacketRevisionId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "INVALID_JSON", message: "Body must be JSON." } }, { status: 400 });
  }
  const o = body !== null && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};

  try {
    const prisma = getPrisma();
    const created = await createEmbeddedPacketTaskLineForLibraryDraftRevision(prisma, {
      tenantId: authGate.principal.tenantId,
      userId: authGate.principal.userId,
      scopePacketId,
      scopePacketRevisionId,
      lineKey: o.lineKey,
      targetNodeKey: o.targetNodeKey,
      title: o.title,
      taskKind: o.taskKind,
      tierCode: o.tierCode,
      sortOrder: o.sortOrder,
    });

    if (created === "not_found") {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "ScopePacketRevision not found in this tenant or does not belong to this packet.",
          },
        },
        { status: 404 },
      );
    }

    const detail = await getScopePacketRevisionDetailForTenant(prisma, {
      tenantId: authGate.principal.tenantId,
      scopePacketId,
      scopePacketRevisionId,
    });

    return NextResponse.json(
      {
        data: { line: created, scopePacketRevisionDetail: detail },
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
