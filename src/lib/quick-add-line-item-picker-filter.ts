import type { LineItemPresetSummaryDto } from "@/server/slice1/reads/line-item-preset-reads";
import type { ScopePacketSummaryDto } from "@/server/slice1/reads/scope-packet-catalog-reads";

/**
 * Pure helpers for the quick-add line-item library picker (Triangle Mode,
 * Step 1 — UX-only).
 *
 * Lives in `src/lib` so the picker UI can be exercised without React or DOM.
 * Mirrors the pattern set by `task-definition-picker-filter.ts`.
 *
 * Constraints (no schema changes; data is already loaded by the page):
 *   - `availableLibraryPackets` is the full tenant-scoped catalog summary list.
 *   - We only ever surface packets with `latestPublishedRevisionId !== null`,
 *     because a quote line item can only pin a PUBLISHED revision (see
 *     `assertScopePacketRevisionIsPublishedForPin` on the write path). Showing
 *     packets without a published revision in the picker would be misleading
 *     and would always fail at submit.
 */

/**
 * Filter to packets that are pinnable today (have at least one PUBLISHED
 * revision). Stable: input order is preserved.
 */
export function filterPinnableLibraryPackets(
  packets: ReadonlyArray<ScopePacketSummaryDto>,
): ScopePacketSummaryDto[] {
  return packets.filter((p) => p.latestPublishedRevisionId !== null);
}

/**
 * Case-insensitive substring filter over `displayName` and `packetKey`.
 * Empty / whitespace-only query returns the input unchanged. Stable order.
 */
export function filterLibraryPacketsByQuery(
  packets: ReadonlyArray<ScopePacketSummaryDto>,
  rawQuery: string,
): ScopePacketSummaryDto[] {
  const q = rawQuery.trim().toLowerCase();
  if (q.length === 0) return [...packets];
  return packets.filter((p) => {
    const name = p.displayName.toLowerCase();
    const key = p.packetKey.toLowerCase();
    return name.includes(q) || key.includes(q);
  });
}

/**
 * Minimal shape required to compute "recent in this quote": just the parent
 * packet id reachable via `scopeRevision.scopePacketId`. Defined structurally
 * so the helper does not depend on the full `QuoteVersionScopeApiDto` type.
 *
 * SOLD_SCOPE lines and lines pinned to a quote-local packet contribute
 * nothing here — the picker is library-only.
 */
export type LineItemForRecent = {
  scopePacketRevisionId: string | null;
  scopeRevision: { scopePacketId: string } | null;
};

/**
 * Compute the top-N parent-packet ids most recently used on this quote
 * version, in **first-seen iteration order** of the input (callers control
 * iteration: typically a flatten of `groupedLineItems`, which already orders
 * by group → sortOrder so the result is deterministic and stable).
 *
 * Properties:
 *   - Deduped by `scopePacketId`.
 *   - Skips items without a library pin (no `scopePacketRevisionId` or no
 *     `scopeRevision` relation).
 *   - Caps at `limit` (default 3 to match the picker's compact strip).
 *   - Pure / total — never throws, returns `[]` when nothing qualifies.
 *
 * Note: returns *parent packet ids*, not revision ids, so the picker can
 * highlight matching summary rows whose `id` is the packet id. The picker
 * still pins the packet's `latestPublishedRevisionId` at select time, never
 * an old revision id read back from history.
 */
/**
 * Case-insensitive substring filter over `displayName` and `presetKey` for
 * line-item presets (Triangle Mode — Phase 2, Slice 2). Mirrors
 * `filterLibraryPacketsByQuery` so the picker can use one shared search box
 * across the two sections without duplicating filter logic.
 *
 * Empty / whitespace-only query returns the input unchanged.
 * `presetKey == null` rows are still searchable by `displayName`.
 */
export function filterPresetsByQuery(
  presets: ReadonlyArray<LineItemPresetSummaryDto>,
  rawQuery: string,
): LineItemPresetSummaryDto[] {
  const q = rawQuery.trim().toLowerCase();
  if (q.length === 0) return [...presets];
  return presets.filter((p) => {
    const name = p.displayName.toLowerCase();
    if (name.includes(q)) return true;
    if (p.presetKey == null) return false;
    return p.presetKey.toLowerCase().includes(q);
  });
}

export function computeRecentLibraryPacketIds(
  lineItems: ReadonlyArray<LineItemForRecent>,
  limit = 3,
): string[] {
  if (limit <= 0) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of lineItems) {
    if (item.scopePacketRevisionId == null) continue;
    if (item.scopeRevision == null) continue;
    const pid = item.scopeRevision.scopePacketId;
    if (seen.has(pid)) continue;
    seen.add(pid);
    out.push(pid);
    if (out.length >= limit) break;
  }
  return out;
}
