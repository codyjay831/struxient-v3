import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import {
  clampLineItemPresetListLimit,
  listLineItemPresetsForTenant,
} from "@/server/slice1/reads/line-item-preset-reads";
import { createLineItemPresetForTenant } from "@/server/slice1/mutations/line-item-preset-mutations";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";

/**
 * GET /api/line-item-presets — tenant-scoped read of saved-line-item presets
 * (Phase 2 / Slice 1).
 *
 * Read-only. Does not resolve `latestPublishedRevisionId`, does not run
 * compose, does not produce execution-derived signals. Future picker / admin
 * UI consumes the same shape.
 *
 * Query params:
 *   - `limit` — clamped via `clampLineItemPresetListLimit` (default 50, max 200).
 *   - `search` — optional case-insensitive substring across `displayName` and
 *     `presetKey`. Whitespace-only is treated as no filter.
 */
export async function GET(request: NextRequest) {
  const authGate = await requireApiPrincipalWithCapability("read");
  if (!authGate.ok) return authGate.response;

  const limit = clampLineItemPresetListLimit(request.nextUrl.searchParams.get("limit"));
  const search = request.nextUrl.searchParams.get("search");

  try {
    const items = await listLineItemPresetsForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      limit,
      search,
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
 * POST /api/line-item-presets — tenant-scoped create for a saved line item
 * (Phase 2 / Slice 3).
 *
 * Body shape (all optional except where noted):
 *   - `displayName` (required, string, 1–200 chars)
 *   - `presetKey` (string | null) — tenant-unique when present
 *   - `defaultTitle` (string | null, ≤500)
 *   - `defaultDescription` (string | null, ≤4000)
 *   - `defaultExecutionMode` (required, "MANIFEST" | "SOLD_SCOPE")
 *   - `defaultScopePacketId` (string | null) — required when MANIFEST,
 *     forbidden when SOLD_SCOPE; tenant ownership is enforced
 *   - `defaultQuantity` (integer ≥ 1 | null)
 *   - `defaultUnitPriceCents` (integer ≥ 0 | null)
 *   - `defaultPaymentBeforeWork` (boolean | null)
 *   - `defaultPaymentGateTitleOverride` (string | null, ≤120)
 *
 * Per-field shape errors propagate as `InvariantViolationError` and are mapped
 * to 400/404/409 by `tenant-json.ts`. Body parse failures yield 400
 * `INVALID_JSON`. Cap is `office_mutate`.
 */
export async function POST(request: NextRequest) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

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
    const dto = await createLineItemPresetForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      userId: authGate.principal.userId,
      displayName: o.displayName,
      presetKey: o.presetKey,
      defaultTitle: o.defaultTitle,
      defaultDescription: o.defaultDescription,
      defaultExecutionMode: o.defaultExecutionMode,
      defaultScopePacketId: o.defaultScopePacketId,
      defaultQuantity: o.defaultQuantity,
      defaultUnitPriceCents: o.defaultUnitPriceCents,
      defaultPaymentBeforeWork: o.defaultPaymentBeforeWork,
      defaultPaymentGateTitleOverride: o.defaultPaymentGateTitleOverride,
    });

    return NextResponse.json(
      {
        data: dto,
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
