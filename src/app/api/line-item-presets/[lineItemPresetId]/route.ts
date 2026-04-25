import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { getLineItemPresetDetailForTenant } from "@/server/slice1/reads/line-item-preset-reads";
import {
  deleteLineItemPresetForTenant,
  updateLineItemPresetForTenant,
} from "@/server/slice1/mutations/line-item-preset-mutations";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";

type RouteContext = { params: Promise<{ lineItemPresetId: string }> };

/**
 * GET /api/line-item-presets/[lineItemPresetId] — tenant-scoped detail read
 * (Phase 2 / Slice 3).
 *
 * Returns the same `LineItemPresetDetailDto` the POST and PATCH paths return,
 * so the admin UI can re-render after a write without a separate fetch shape.
 */
export async function GET(_request: NextRequest, ctx: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("read");
  if (!authGate.ok) return authGate.response;

  const { lineItemPresetId } = await ctx.params;

  try {
    const detail = await getLineItemPresetDetailForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      presetId: lineItemPresetId,
    });
    if (!detail) {
      return NextResponse.json(
        {
          error: {
            code: "LINE_ITEM_PRESET_NOT_FOUND",
            message: "Saved line item not found in this tenant.",
          },
        },
        { status: 404 },
      );
    }
    return NextResponse.json({
      data: detail,
      meta: apiAuthMeta(authGate.principal),
    });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}

/**
 * PATCH /api/line-item-presets/[lineItemPresetId] — partial update.
 *
 * Body shape: any subset of the create body. Omitted properties leave the
 * column untouched; explicit `null` clears nullable columns. Mode flips are
 * validated against the **post-patch** state, so a MANIFEST → SOLD_SCOPE flip
 * must also clear `defaultScopePacketId` and a SOLD_SCOPE → MANIFEST flip
 * must supply one.
 */
export async function PATCH(request: NextRequest, ctx: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  const { lineItemPresetId } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Body must be JSON." } },
      { status: 400 },
    );
  }
  const o =
    body !== null && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};

  try {
    const result = await updateLineItemPresetForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      userId: authGate.principal.userId,
      lineItemPresetId,
      // Forward every property the caller actually sent (`in` check) so we
      // distinguish "leave untouched" (omitted) from "clear" (explicit null).
      ...("displayName" in o ? { displayName: o.displayName } : {}),
      ...("presetKey" in o ? { presetKey: o.presetKey } : {}),
      ...("defaultTitle" in o ? { defaultTitle: o.defaultTitle } : {}),
      ...("defaultDescription" in o ? { defaultDescription: o.defaultDescription } : {}),
      ...("defaultExecutionMode" in o ? { defaultExecutionMode: o.defaultExecutionMode } : {}),
      ...("defaultScopePacketId" in o ? { defaultScopePacketId: o.defaultScopePacketId } : {}),
      ...("defaultQuantity" in o ? { defaultQuantity: o.defaultQuantity } : {}),
      ...("defaultUnitPriceCents" in o ? { defaultUnitPriceCents: o.defaultUnitPriceCents } : {}),
      ...("defaultPaymentBeforeWork" in o
        ? { defaultPaymentBeforeWork: o.defaultPaymentBeforeWork }
        : {}),
      ...("defaultPaymentGateTitleOverride" in o
        ? { defaultPaymentGateTitleOverride: o.defaultPaymentGateTitleOverride }
        : {}),
    });

    if (result === "not_found") {
      return NextResponse.json(
        {
          error: {
            code: "LINE_ITEM_PRESET_NOT_FOUND",
            message: "Saved line item not found in this tenant.",
          },
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      data: result,
      meta: apiAuthMeta(authGate.principal),
    });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}

/**
 * DELETE /api/line-item-presets/[lineItemPresetId] — tenant-scoped delete.
 *
 * Idempotent for the caller: cross-tenant probes return 404 with the same
 * `LINE_ITEM_PRESET_NOT_FOUND` shape as a true miss (no information leak).
 * The linked `ScopePacket` (if any) is **not** affected; existing
 * `QuoteLineItem` rows that were once authored from this preset are also
 * unaffected because Slice 2 prefill snapshots commercial values into the
 * line item itself.
 */
export async function DELETE(_request: NextRequest, ctx: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  const { lineItemPresetId } = await ctx.params;

  try {
    const result = await deleteLineItemPresetForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      userId: authGate.principal.userId,
      lineItemPresetId,
    });
    if (result === "not_found") {
      return NextResponse.json(
        {
          error: {
            code: "LINE_ITEM_PRESET_NOT_FOUND",
            message: "Saved line item not found in this tenant.",
          },
        },
        { status: 404 },
      );
    }
    return NextResponse.json({
      data: { deleted: true as const },
      meta: apiAuthMeta(authGate.principal),
    });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
