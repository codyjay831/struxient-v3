import type {
  Prisma,
  PrismaClient,
  QuoteLineItemExecutionMode,
} from "@prisma/client";
import { summarizeScopePacketRevisions } from "@/lib/scope-packet-catalog-summary";

/**
 * Tenant-scoped READ-ONLY catalog reads for `LineItemPreset` (Phase 2 — Saved
 * Line Items, Slice 1).
 *
 * A preset is a **commercial-defaults catalog row**. It does NOT participate in
 * compose, activation, or any RuntimeTask logic. The reads in this module:
 *
 *   - never mutate
 *   - never resolve `latestPublishedRevisionId` (that is a selection-time
 *     concern handled by the scope editor in a future slice)
 *   - never join workflow / execution surfaces
 *   - never compute execution-derived signals
 *
 * Tenant scoping is always enforced via `LineItemPreset.tenantId`.
 *
 * The `defaultScopePacket` join below is `SetNull`-friendly: if the underlying
 * packet is deleted, `defaultScopePacketId` becomes null and the hydrated DTO
 * surfaces `defaultScopePacket = null`. The future picker uses that signal to
 * render a "packet missing — re-link" affordance instead of crashing.
 *
 * Canon refs:
 *   - docs/canon/05-packet-canon.md (PUBLISHED revision discipline; latest is
 *     resolved at selection time, not stored)
 *   - docs/canon/04-quote-line-item-canon.md (commercial vs. execution split)
 */

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

/**
 * Clamps a `?limit=` query string for the preset list to a safe range.
 * Mirrors `clampScopePacketListLimit` / `clampTaskDefinitionListLimit` so the
 * preset list cannot be turned into an unbounded data dump.
 */
export function clampLineItemPresetListLimit(raw: string | null): number {
  if (raw == null || raw === "") return DEFAULT_LIST_LIMIT;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIST_LIMIT;
  return Math.min(n, MAX_LIST_LIMIT);
}

export const LINE_ITEM_PRESET_LIST_LIMIT_DEFAULTS = {
  default: DEFAULT_LIST_LIMIT,
  max: MAX_LIST_LIMIT,
} as const;

/**
 * Hydrated reference to the parent `ScopePacket` a preset points at. Null when
 * the preset is `SOLD_SCOPE` (no packet) or when the referenced packet was
 * deleted (`SetNull` FK). The future picker uses both branches differently —
 * `SOLD_SCOPE` is a normal preset shape, "preset references deleted packet" is
 * a re-link affordance.
 *
 * `latestPublishedRevisionId` / `latestPublishedRevisionNumber` are resolved at
 * read time by reusing `summarizeScopePacketRevisions` over the packet's full
 * revision list (same convention as `ScopePacketSummaryDto`). They are
 * **never** stored on `LineItemPreset` itself — the preset references the
 * **parent** packet and the picker pins the latest published revision at
 * selection time. When the parent packet has zero PUBLISHED revisions both
 * fields are null, and the picker treats the preset as "unusable for MANIFEST
 * — no published revision yet" (per Slice 2 invariants).
 */
export type LineItemPresetPacketRefDto = {
  id: string;
  packetKey: string;
  displayName: string;
  latestPublishedRevisionId: string | null;
  latestPublishedRevisionNumber: number | null;
};

export type LineItemPresetSummaryDto = {
  id: string;
  presetKey: string | null;
  displayName: string;
  defaultExecutionMode: QuoteLineItemExecutionMode;
  defaultScopePacketId: string | null;
  /**
   * Hydrated sibling of `defaultScopePacketId`. Surfaced even on the summary
   * row so the picker can render the packet name/key inline without a second
   * round-trip. **Not** an execution signal — no revisionNumber, no readiness.
   */
  defaultScopePacket: LineItemPresetPacketRefDto | null;
  /**
   * Commercial defaults are surfaced on the summary so list views (admin
   * index, picker rows) can show price/quantity/payment-gate signals without
   * a second round-trip per row. Mirrors Slice 2's precedent of folding
   * "needed everywhere" hydrated fields into the summary shape.
   *
   * The full description is **not** included on the summary (see detail) to
   * keep the row payload small.
   */
  defaultQuantity: number | null;
  defaultUnitPriceCents: number | null;
  defaultPaymentBeforeWork: boolean | null;
  createdAtIso: string;
  updatedAtIso: string;
};

export type LineItemPresetDetailDto = LineItemPresetSummaryDto & {
  defaultTitle: string | null;
  defaultDescription: string | null;
  defaultPaymentGateTitleOverride: string | null;
};

const SUMMARY_SELECT = {
  id: true,
  presetKey: true,
  displayName: true,
  defaultExecutionMode: true,
  defaultScopePacketId: true,
  defaultScopePacket: {
    select: {
      id: true,
      packetKey: true,
      displayName: true,
      revisions: {
        select: {
          id: true,
          revisionNumber: true,
          status: true,
          publishedAt: true,
        },
      },
    },
  },
  defaultQuantity: true,
  defaultUnitPriceCents: true,
  defaultPaymentBeforeWork: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.LineItemPresetSelect;

type SummaryRow = Prisma.LineItemPresetGetPayload<{ select: typeof SUMMARY_SELECT }>;

const DETAIL_SELECT = {
  ...SUMMARY_SELECT,
  defaultTitle: true,
  defaultDescription: true,
  defaultPaymentGateTitleOverride: true,
} satisfies Prisma.LineItemPresetSelect;

type DetailRow = Prisma.LineItemPresetGetPayload<{ select: typeof DETAIL_SELECT }>;

function mapSummary(row: SummaryRow): LineItemPresetSummaryDto {
  let packetRef: LineItemPresetPacketRefDto | null = null;
  if (row.defaultScopePacket) {
    const summary = summarizeScopePacketRevisions(row.defaultScopePacket.revisions);
    packetRef = {
      id: row.defaultScopePacket.id,
      packetKey: row.defaultScopePacket.packetKey,
      displayName: row.defaultScopePacket.displayName,
      latestPublishedRevisionId: summary.latestPublishedRevisionId,
      latestPublishedRevisionNumber: summary.latestPublishedRevisionNumber,
    };
  }
  return {
    id: row.id,
    presetKey: row.presetKey,
    displayName: row.displayName,
    defaultExecutionMode: row.defaultExecutionMode,
    defaultScopePacketId: row.defaultScopePacketId,
    defaultScopePacket: packetRef,
    defaultQuantity: row.defaultQuantity,
    defaultUnitPriceCents: row.defaultUnitPriceCents,
    defaultPaymentBeforeWork: row.defaultPaymentBeforeWork,
    createdAtIso: row.createdAt.toISOString(),
    updatedAtIso: row.updatedAt.toISOString(),
  };
}

function mapDetail(row: DetailRow): LineItemPresetDetailDto {
  return {
    ...mapSummary(row),
    defaultTitle: row.defaultTitle,
    defaultDescription: row.defaultDescription,
    defaultPaymentGateTitleOverride: row.defaultPaymentGateTitleOverride,
  };
}

/**
 * Trims a search query and rejects empties. Callers that pass `undefined` get
 * an unfiltered list. Returns `null` when the trimmed query is empty so the
 * caller can avoid building a `where` clause that matches everything.
 */
function normalizePresetSearchQuery(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  return trimmed;
}

/**
 * List preset summaries visible to a tenant.
 *
 * - Tenant-scoped via `tenantId`.
 * - `limit` MUST already be clamped via `clampLineItemPresetListLimit` (the
 *   API route does this); this function does not re-clamp.
 * - `search`, when provided and non-empty after trim, matches case-insensitively
 *   against `displayName` and `presetKey`. Rows with `presetKey == null` are
 *   only matched via `displayName` (Postgres `null contains x` is null/false).
 *
 * Order: `displayName` ascending, then `id` ascending for a stable tiebreak.
 * (We deliberately do not surface row counts or sort by recency — the picker
 * is alphabetical by name; recency is a per-quote concern handled elsewhere.)
 */
export async function listLineItemPresetsForTenant(
  prisma: PrismaClient,
  params: { tenantId: string; limit: number; search?: string | null },
): Promise<LineItemPresetSummaryDto[]> {
  const search = normalizePresetSearchQuery(params.search ?? null);

  const where: Prisma.LineItemPresetWhereInput = { tenantId: params.tenantId };
  if (search !== null) {
    where.OR = [
      { displayName: { contains: search, mode: "insensitive" } },
      { presetKey: { contains: search, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.lineItemPreset.findMany({
    where,
    orderBy: [{ displayName: "asc" }, { id: "asc" }],
    take: params.limit,
    select: SUMMARY_SELECT,
  });
  return rows.map(mapSummary);
}

/**
 * Single preset detail by id. Returns `null` when the preset is not visible to
 * the tenant. Includes commercial defaults (title, description, quantity,
 * price, payment flags) plus the same hydrated packet ref the summary carries.
 *
 * This is the read shape the future write slice will round-trip; it is also
 * what the future "manage presets" admin UI will render.
 */
export async function getLineItemPresetDetailForTenant(
  prisma: PrismaClient,
  params: { tenantId: string; presetId: string },
): Promise<LineItemPresetDetailDto | null> {
  const row: DetailRow | null = await prisma.lineItemPreset.findFirst({
    where: { id: params.presetId, tenantId: params.tenantId },
    select: DETAIL_SELECT,
  });
  if (!row) return null;
  return mapDetail(row);
}
