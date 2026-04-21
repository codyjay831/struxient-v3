/**
 * Pure 1:1 mapping from a `PacketTaskLine` row on the current PUBLISHED
 * `ScopePacketRevision` to a `PacketTaskLine` `create` payload for the new
 * revision-N+1 DRAFT clone.
 *
 * Field-for-field identical: `lineKey`, `sortOrder`, `tierCode`, `lineKind`,
 * `embeddedPayloadJson` (deep-cloned), `taskDefinitionId`, `targetNodeKey`.
 * No reordering, no merge, no schema-shape changes. Lives in `src/lib` so it
 * can be unit-tested without Prisma; the create-DRAFT mutation wraps this in
 * a transaction with the new `ScopePacketRevision` row.
 *
 * Both source and destination columns are `Json` NOT NULL, so the asymmetric
 * nullability handling required by the promotion / fork mappers is not needed
 * here — the contract is "object | array" verbatim. Defensive scalar handling
 * is preserved (mirroring the promotion mapper) so legacy data with stray
 * scalar payloads coerces to `{}` rather than leaking through.
 *
 * Canon refs:
 *   - docs/canon/05-packet-canon.md ("Canon amendment — revision-2 evolution
 *     policy (post-publish)")
 *   - docs/implementation/decision-packs/revision-2-evolution-decision-pack.md §3
 */

export type CloneSourcePacketTaskLine = {
  lineKey: string;
  sortOrder: number;
  tierCode: string | null;
  lineKind: "EMBEDDED" | "LIBRARY";
  /**
   * Source column is `Json` NOT NULL. Carries either a real EMBEDDED payload
   * object/array, or `{}` for LIBRARY rows. Stray scalars in legacy data are
   * normalized to `{}` (matching the promotion mapper).
   */
  embeddedPayloadJson: unknown;
  taskDefinitionId: string | null;
  targetNodeKey: string;
};

export type ClonedPacketTaskLineCreate = {
  lineKey: string;
  sortOrder: number;
  tierCode: string | null;
  lineKind: "EMBEDDED" | "LIBRARY";
  embeddedPayloadJson: Record<string, unknown> | unknown[];
  taskDefinitionId: string | null;
  targetNodeKey: string;
};

export function mapPacketTaskLineToCloneCreate(
  src: CloneSourcePacketTaskLine,
): ClonedPacketTaskLineCreate {
  return {
    lineKey: src.lineKey,
    sortOrder: src.sortOrder,
    tierCode: src.tierCode,
    lineKind: src.lineKind,
    embeddedPayloadJson: normalizeEmbeddedPayloadForClone(src.embeddedPayloadJson),
    taskDefinitionId: src.taskDefinitionId,
    targetNodeKey: src.targetNodeKey,
  };
}

export function normalizeEmbeddedPayloadForClone(
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
