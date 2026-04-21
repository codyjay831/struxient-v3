/**
 * Pure 1:1 inverse mapping from `PacketTaskLine` rows on a PUBLISHED
 * `ScopePacketRevision` to `QuoteLocalPacketItem` `create` payloads for the
 * interim quote-local fork-from-library flow.
 *
 * This is the symmetric inverse of `packet-promotion-mapping.ts`. Field-for-
 * field locked by canon. Lives in `src/lib` so it can be unit-tested without
 * Prisma; the mutation layer wraps this in a transaction with a fresh
 * `QuoteLocalPacket` row.
 *
 * Asymmetric nullability handling:
 *   - `PacketTaskLine.embeddedPayloadJson` is `Json` (NOT NULL); the forward
 *     promotion mapper writes `{}` when the source `QuoteLocalPacketItem`
 *     row carried `null` (typically a LIBRARY row).
 *   - `QuoteLocalPacketItem.embeddedPayloadJson` is `Json?` (nullable). The
 *     inverse here preserves whatever value is present without coercing back
 *     to `null` — `{}` round-trips faithfully, and any genuine inline payload
 *     on an EMBEDDED row is preserved verbatim. No information is invented.
 *
 * Canon refs:
 *   - docs/canon/05-packet-canon.md §100-101 (Packet-level override policy:
 *     task mutation must fork to a QuoteLocalPacket as a deep copy)
 *   - docs/canon/05-packet-canon.md §134-147 (Canonical mapping table — this
 *     file walks the same columns in the inverse direction)
 *   - docs/bridge-decisions/03-packet-fork-promotion-decision.md
 *   - docs/epics/16-packet-task-lines-epic.md §16a (targetNodeKey parity)
 */

export type ForkSourcePacketTaskLine = {
  lineKey: string;
  sortOrder: number;
  tierCode: string | null;
  lineKind: "EMBEDDED" | "LIBRARY";
  /**
   * Source column is `Json` NOT NULL. Carries either a real EMBEDDED payload
   * object/array, or `{}` for LIBRARY rows (per the forward promotion mapper's
   * NOT-NULL contract). May also be a stray scalar in legacy data — handled
   * defensively below to avoid leaking unexpected shapes into the destination.
   */
  embeddedPayloadJson: unknown;
  taskDefinitionId: string | null;
  targetNodeKey: string;
};

export type ForkedQuoteLocalPacketItemCreate = {
  lineKey: string;
  sortOrder: number;
  tierCode: string | null;
  lineKind: "EMBEDDED" | "LIBRARY";
  /**
   * Destination column is `Json?` (nullable). We preserve the source value
   * verbatim (deep-cloned for objects/arrays); we do not coerce `{}` back to
   * `null` because the source's NOT-NULL coercion is a one-way contract and
   * round-tripping should be idempotent at the field-value level.
   *
   * Stray non-object/non-array scalars are normalized to `{}` (matching the
   * forward mapper's behavior) so the destination never sees a shape outside
   * the documented `object | array | null` envelope.
   */
  embeddedPayloadJson: Record<string, unknown> | unknown[] | null;
  taskDefinitionId: string | null;
  targetNodeKey: string;
};

/**
 * Build the destination `QuoteLocalPacketItem.create` payload from one source
 * `PacketTaskLine` row. No mutation of the source. No reordering. No merge.
 * No schema-shape changes.
 */
export function mapPacketTaskLineToQuoteLocalPacketItemCreate(
  src: ForkSourcePacketTaskLine,
): ForkedQuoteLocalPacketItemCreate {
  return {
    lineKey: src.lineKey,
    sortOrder: src.sortOrder,
    tierCode: src.tierCode,
    lineKind: src.lineKind,
    embeddedPayloadJson: normalizeEmbeddedPayloadForFork(src.embeddedPayloadJson),
    taskDefinitionId: src.taskDefinitionId,
    targetNodeKey: src.targetNodeKey,
  };
}

/**
 * `PacketTaskLine.embeddedPayloadJson` is `Json` NOT NULL on the source.
 * `QuoteLocalPacketItem.embeddedPayloadJson` is `Json?` on the destination.
 *
 * Behavior:
 *   - object/array → deep-cloned (so later edits to the local copy cannot
 *     mutate the source row in memory if both sides happen to share a request).
 *   - null/undefined → null (defensive — the source schema forbids null, but
 *     coding to it lets the unit tests cover the contract precisely).
 *   - scalar (string/number/boolean) → `{}` (avoids leaking inline meaning
 *     that the destination shape does not support; matches the forward mapper).
 */
export function normalizeEmbeddedPayloadForFork(
  raw: unknown,
): Record<string, unknown> | unknown[] | null {
  if (raw === null || raw === undefined) return null;
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
