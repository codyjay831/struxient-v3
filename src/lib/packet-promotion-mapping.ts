/**
 * Pure 1:1 mapping from `QuoteLocalPacketItem` rows to `PacketTaskLine`
 * `create` payloads for the interim one-step promotion flow.
 *
 * Field-for-field locked by canon. Lives in `src/lib` so it can be unit-tested
 * without Prisma; the mutation layer wraps this in a transaction with
 * `ScopePacket` / `ScopePacketRevision` creates.
 *
 * Canon refs:
 *   - docs/canon/05-packet-canon.md (Canonical mapping table)
 *   - docs/implementation/decision-packs/interim-packet-promotion-decision-pack.md §4
 *   - docs/epics/16-packet-task-lines-epic.md §16a
 */

export type PromotionSourceItem = {
  lineKey: string;
  sortOrder: number;
  tierCode: string | null;
  lineKind: "EMBEDDED" | "LIBRARY";
  embeddedPayloadJson: unknown;
  taskDefinitionId: string | null;
  targetNodeKey: string;
};

export type PromotedPacketTaskLineCreate = {
  lineKey: string;
  sortOrder: number;
  tierCode: string | null;
  lineKind: "EMBEDDED" | "LIBRARY";
  /**
   * `PacketTaskLine.embeddedPayloadJson` is `Json` (NOT NULL). When the source
   * carried `null` (typically a LIBRARY row), we write the empty object to
   * satisfy the contract while preserving "no inline meaning" semantics.
   */
  embeddedPayloadJson: Record<string, unknown> | unknown[];
  taskDefinitionId: string | null;
  targetNodeKey: string;
};

/**
 * Build the destination `PacketTaskLine.create` payload from one source row.
 * No mutation of the source. No reordering. No merge. No schema-shape changes.
 */
export function mapQuoteLocalPacketItemToPacketTaskLineCreate(
  src: PromotionSourceItem,
): PromotedPacketTaskLineCreate {
  const payload = normalizeEmbeddedPayloadForPromotion(src.embeddedPayloadJson);
  return {
    lineKey: src.lineKey,
    sortOrder: src.sortOrder,
    tierCode: src.tierCode,
    lineKind: src.lineKind,
    embeddedPayloadJson: payload,
    taskDefinitionId: src.taskDefinitionId,
    targetNodeKey: src.targetNodeKey,
  };
}

/**
 * `QuoteLocalPacketItem.embeddedPayloadJson` is nullable; `PacketTaskLine.embeddedPayloadJson`
 * is NOT NULL. Per canon: write `{}` when the source is null/absent so the destination
 * column contract is satisfied without inventing inline meaning.
 *
 * Arrays and objects are deep-cloned to prevent the source row from sharing the
 * destination's reference. Scalars are coerced to `{}` because the destination
 * shape is "object-or-empty"; treating a stray scalar as inline meaning would be
 * incorrect.
 */
export function normalizeEmbeddedPayloadForPromotion(
  raw: unknown,
): Record<string, unknown> | unknown[] {
  if (raw === null || raw === undefined) return {};
  if (Array.isArray(raw)) return raw.map((v) => deepClone(v)) as unknown[];
  if (typeof raw === "object") {
    return deepClone(raw as Record<string, unknown>);
  }
  return {};
}

function deepClone<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((v) => deepClone(v)) as unknown as T;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = deepClone(v);
  }
  return out as unknown as T;
}
