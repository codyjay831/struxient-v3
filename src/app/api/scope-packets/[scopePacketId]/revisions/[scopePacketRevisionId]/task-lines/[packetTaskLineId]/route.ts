import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import {
  deletePacketTaskLineForLibraryDraftRevision,
  reorderPacketTaskLineSortOrderForLibraryDraftRevision,
  updatePacketTaskLineForLibraryDraftRevision,
} from "@/server/slice1/mutations/packet-task-line-library-mutations";
import { getScopePacketRevisionDetailForTenant } from "@/server/slice1/reads/scope-packet-catalog-reads";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";

/**
 * DELETE …/task-lines/[packetTaskLineId] — remove a line from a **DRAFT** revision (`office_mutate`).
 *
 * PATCH …/task-lines/[packetTaskLineId] — reorder (`sortOrder` only) on a **DRAFT** revision (`office_mutate`).
 * Body: `{ "direction": "up" | "down" }`.
 *
 * PUT …/task-lines/[packetTaskLineId] — bounded field edit on a **DRAFT** revision (`office_mutate`).
 * Body may include any of: `targetNodeKey`, `tierCode`, `title` (EMBEDDED only), `taskKind` (EMBEDDED only).
 * Only keys present in the JSON object are applied (partial update).
 */
type RouteContext = {
  params: Promise<{ scopePacketId: string; scopePacketRevisionId: string; packetTaskLineId: string }>;
};

export async function PUT(request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  const { scopePacketId, scopePacketRevisionId, packetTaskLineId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "INVALID_JSON", message: "Body must be JSON." } }, { status: 400 });
  }
  const o = body !== null && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};

  const patch: {
    targetNodeKey?: unknown;
    tierCode?: unknown;
    title?: unknown;
    taskKind?: unknown;
  } = {};
  if ("targetNodeKey" in o) patch.targetNodeKey = o.targetNodeKey;
  if ("tierCode" in o) patch.tierCode = o.tierCode;
  if ("title" in o) patch.title = o.title;
  if ("taskKind" in o) patch.taskKind = o.taskKind;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_BODY",
          message: "Provide at least one of: targetNodeKey, tierCode, title (EMBEDDED), taskKind (EMBEDDED).",
        },
      },
      { status: 400 },
    );
  }

  try {
    const prisma = getPrisma();
    const result = await updatePacketTaskLineForLibraryDraftRevision(prisma, {
      tenantId: authGate.principal.tenantId,
      userId: authGate.principal.userId,
      scopePacketId,
      scopePacketRevisionId,
      packetTaskLineId,
      patch,
    });

    if (result === "not_found") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Packet task line or revision not found for this tenant." } },
        { status: 404 },
      );
    }

    const detail = await getScopePacketRevisionDetailForTenant(prisma, {
      tenantId: authGate.principal.tenantId,
      scopePacketId,
      scopePacketRevisionId,
    });

    return NextResponse.json({
      data: { updated: true, scopePacketRevisionDetail: detail },
      meta: apiAuthMeta(authGate.principal),
    });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  const { scopePacketId, scopePacketRevisionId, packetTaskLineId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "INVALID_JSON", message: "Body must be JSON." } }, { status: 400 });
  }
  const o = body !== null && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const d = o.direction;
  if (d !== "up" && d !== "down") {
    return NextResponse.json(
      { error: { code: "INVALID_BODY", message: 'Body must include direction: "up" or "down".' } },
      { status: 400 },
    );
  }

  try {
    const prisma = getPrisma();
    const result = await reorderPacketTaskLineSortOrderForLibraryDraftRevision(prisma, {
      tenantId: authGate.principal.tenantId,
      userId: authGate.principal.userId,
      scopePacketId,
      scopePacketRevisionId,
      packetTaskLineId,
      direction: d,
    });

    if (result === "not_found") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Packet task line or revision not found for this tenant." } },
        { status: 404 },
      );
    }

    const detail = await getScopePacketRevisionDetailForTenant(prisma, {
      tenantId: authGate.principal.tenantId,
      scopePacketId,
      scopePacketRevisionId,
    });

    return NextResponse.json({
      data: { reordered: true, scopePacketRevisionDetail: detail },
      meta: apiAuthMeta(authGate.principal),
    });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}

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
