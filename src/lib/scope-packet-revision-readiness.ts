/**
 * Pure publish-readiness predicate for a `ScopePacketRevision`.
 *
 * Operationalizes the publish gates that canon already names but no code yet
 * machine-checks. Used by the read-only catalog inspector to tell estimators
 * whether a `DRAFT` revision (typically produced by the interim one-step
 * promotion flow) would be safe for a future publish action to advance.
 *
 * **This module ships no transition.** It is pure observation. The result is
 * structured so a future publish mutation, the deferred admin-review queue,
 * and the inspector UI can all consume the same predicate verbatim.
 *
 * No Prisma dependency; runs on plain rows so it is fully unit-testable.
 *
 * Canon refs:
 *   - docs/canon/05-packet-canon.md ("PUBLISHED revision discipline for pickers",
 *     "Canonical QuoteLocalPacketItem → PacketTaskLine mapping contract")
 *   - docs/epics/15-scope-packets-epic.md §16 (publish gate: ≥1 task line),
 *     §155 (interim DRAFT exists explicitly to be advanced later)
 *   - docs/epics/16-packet-task-lines-epic.md §6 + §81 (`targetNodeKey` is a
 *     top-level required column; must exist on compatibility template set)
 *   - docs/implementation/decision-packs/interim-packet-promotion-decision-pack.md §7
 *
 * Out of scope: this module deliberately does NOT enforce
 *   - tier coverage (PacketTier deferred)
 *   - per-tenant template-compatibility membership for `targetNodeKey`
 *     (compose-engine territory; not a publish-gate-only signal)
 *   - duplicate `lineKey` (impossible from current read data due to the
 *     `@@unique([scopePacketRevisionId, lineKey])` DB constraint).
 */

import type { PacketTaskLineKind, TaskDefinitionStatus } from "@prisma/client";

/**
 * Sentinel value written to `PacketTaskLine.targetNodeKey` by the
 * `20260420120000_packet_promotion_authorize` migration when a legacy row had
 * no resolvable value at backfill time. Compose-engine treats it as missing;
 * readiness must too. Promoted-after-this-date rows never carry it.
 */
export const TARGET_NODE_KEY_BACKFILL_SENTINEL = "__missing__";

/** Closed, explicit blocker-code union. */
export type ScopePacketRevisionReadinessBlockerCode =
  | "EMPTY_REVISION"
  | "MISSING_TARGET_NODE_KEY"
  | "TARGET_NODE_KEY_SENTINEL"
  | "LIBRARY_ROW_TASK_DEFINITION_MISSING"
  | "LIBRARY_ROW_TASK_DEFINITION_NOT_PUBLISHED"
  | "EMBEDDED_ROW_PAYLOAD_EMPTY";

export type ScopePacketRevisionReadinessBlocker = {
  code: ScopePacketRevisionReadinessBlockerCode;
  /** Human-readable one-liner; safe to render in the inspector verbatim. */
  message: string;
  /** Always present for line-scoped blockers; absent for revision-scoped (`EMPTY_REVISION`). */
  lineId?: string;
  /** Always present for line-scoped blockers (mirrors `lineId`'s row). */
  lineKey?: string;
  /** Present for `LIBRARY_ROW_*` blockers; null when LIBRARY row had no id at all. */
  taskDefinitionId?: string | null;
  /** Present for `LIBRARY_ROW_TASK_DEFINITION_NOT_PUBLISHED` to surface the offending state. */
  taskDefinitionStatus?: TaskDefinitionStatus;
};

export type ScopePacketRevisionReadinessLine = {
  id: string;
  lineKey: string;
  lineKind: PacketTaskLineKind;
  targetNodeKey: string;
  embeddedPayloadJson: unknown;
  taskDefinitionId: string | null;
  /** Resolved relation snapshot; null when `taskDefinitionId` is null OR the
   * relation row was deleted (`PacketTaskLine.taskDefinition` uses `SetNull`). */
  taskDefinition: { id: string; status: TaskDefinitionStatus } | null;
};

export type ScopePacketRevisionReadinessInput = {
  packetTaskLines: ReadonlyArray<ScopePacketRevisionReadinessLine>;
};

export type ScopePacketRevisionReadinessResult = {
  isReady: boolean;
  blockers: ScopePacketRevisionReadinessBlocker[];
};

/**
 * Evaluates publish readiness against canon-grounded gates only. The order of
 * blockers in the output is stable (revision-scoped first, then line-scoped in
 * input order) so the inspector renders deterministically. Caller must not
 * mutate `input`.
 */
export function evaluateScopePacketRevisionReadiness(
  input: ScopePacketRevisionReadinessInput,
): ScopePacketRevisionReadinessResult {
  const blockers: ScopePacketRevisionReadinessBlocker[] = [];

  if (input.packetTaskLines.length === 0) {
    blockers.push({
      code: "EMPTY_REVISION",
      message:
        "Revision has no PacketTaskLine rows. Publish gate (epic 15 §16) requires at least one task line.",
    });
    return { isReady: false, blockers };
  }

  for (const line of input.packetTaskLines) {
    if (line.targetNodeKey === "" || line.targetNodeKey == null) {
      blockers.push({
        code: "MISSING_TARGET_NODE_KEY",
        message:
          "Task line has no targetNodeKey. Epic 16 §6/§81 requires a non-empty top-level value.",
        lineId: line.id,
        lineKey: line.lineKey,
      });
    } else if (line.targetNodeKey === TARGET_NODE_KEY_BACKFILL_SENTINEL) {
      blockers.push({
        code: "TARGET_NODE_KEY_SENTINEL",
        message:
          "Task line carries the migration backfill sentinel for targetNodeKey; supply a real value before publishing.",
        lineId: line.id,
        lineKey: line.lineKey,
      });
    }

    if (line.lineKind === "LIBRARY") {
      if (line.taskDefinitionId == null || line.taskDefinitionId === "") {
        blockers.push({
          code: "LIBRARY_ROW_TASK_DEFINITION_MISSING",
          message:
            "LIBRARY task line has no taskDefinitionId. Canon (05) requires a TaskDefinition reference.",
          lineId: line.id,
          lineKey: line.lineKey,
          taskDefinitionId: null,
        });
      } else if (line.taskDefinition == null) {
        blockers.push({
          code: "LIBRARY_ROW_TASK_DEFINITION_MISSING",
          message:
            "LIBRARY task line references a TaskDefinition that no longer exists (orphaned via SetNull).",
          lineId: line.id,
          lineKey: line.lineKey,
          taskDefinitionId: line.taskDefinitionId,
        });
      } else if (line.taskDefinition.status !== "PUBLISHED") {
        blockers.push({
          code: "LIBRARY_ROW_TASK_DEFINITION_NOT_PUBLISHED",
          message:
            "LIBRARY task line references a non-PUBLISHED TaskDefinition. Picker contract (epic 09) requires PUBLISHED.",
          lineId: line.id,
          lineKey: line.lineKey,
          taskDefinitionId: line.taskDefinition.id,
          taskDefinitionStatus: line.taskDefinition.status,
        });
      }
    }

    if (line.lineKind === "EMBEDDED" && !isEmbeddedPayloadPresent(line.embeddedPayloadJson)) {
      blockers.push({
        code: "EMBEDDED_ROW_PAYLOAD_EMPTY",
        message:
          "EMBEDDED task line has no inline payload (empty object/array or missing). EMBEDDED rows must carry meaning to be publishable.",
        lineId: line.id,
        lineKey: line.lineKey,
      });
    }
  }

  return { isReady: blockers.length === 0, blockers };
}

/**
 * Mirrors the catalog reads' `isEmbeddedPayloadPresent` heuristic: the column
 * is NOT NULL by schema, but `{}`, `[]`, or non-object scalars carry no
 * publishable meaning. Kept in-module so the predicate has no Prisma/reads
 * dependency.
 */
function isEmbeddedPayloadPresent(json: unknown): boolean {
  if (json === null || json === undefined) return false;
  if (typeof json !== "object") return Boolean(json);
  if (Array.isArray(json)) return json.length > 0;
  return Object.keys(json as Record<string, unknown>).length > 0;
}
