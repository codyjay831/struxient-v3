/**
 * Pure projection: build a read-only "execution preview" for a single
 * `QuoteLineItem` so the scope authoring UI can show — under each row —
 * what runtime tasks the line will eventually compose into.
 *
 * Triangle Mode UX goal (Phase 1, Slice C):
 *   line item → packet → task lines → workflow stages → (future) runtime tasks
 *
 * Important canon constraints baked into this helper:
 *   - This is *not* a compose-engine substitute. It does NOT explode quantity,
 *     does NOT evaluate tier filters, does NOT validate `targetNodeKey` against
 *     the snapshot beyond surfacing an `isOnSnapshot` flag, and does NOT
 *     produce `RuntimeTask` rows. Compose remains the source of truth at
 *     send/freeze time (see `src/server/slice1/compose-preview/compose-engine.ts`).
 *   - It only describes the *packet contents* a `MANIFEST` line would compose
 *     from, plus a small commercial-only message for `SOLD_SCOPE` lines.
 *   - It is pure — all I/O happens in the loader (see
 *     `src/server/slice1/reads/line-item-execution-preview-support.ts`).
 *     This module only consumes already-fetched DTOs and returns view data.
 *
 * The shape mirrors the natural "library | local | none | sold" branching the
 * UI cares about, so the renderer can switch on `kind` without re-deriving
 * facts from raw inputs.
 */

import {
  COMPLETION_REQUIREMENT_KINDS,
  parseCompletionRequirements,
  type CompletionRequirement,
  type CompletionRequirementKind,
} from "./task-definition-authored-requirements";
import { humanizeWorkflowNodeId } from "./workflow-node-display";
import type { WorkflowNodeKeyProjection } from "./workflow-snapshot-node-projection";

/** Canonical revision lifecycle states surfaced by `ScopePacketRevisionDetailDto`. */
export type ExecutionPreviewRevisionStatus = "DRAFT" | "PUBLISHED" | "SUPERSEDED";

/**
 * Light reference to a `TaskDefinition` row used for telling
 * "library-backed task" apart from "embedded inline payload" in the UI.
 */
export type ExecutionPreviewTaskDefinitionRef = {
  id: string;
  taskKey: string;
  displayName: string;
  /** Library status (DRAFT / PUBLISHED / ARCHIVED) — surfaced for visibility. */
  status: string;
};

/**
 * Stage projection for a packet task line's `targetNodeKey`. The raw
 * `nodeId` is always preserved so technical operators can verify the
 * compose binding; `displayLabel` is only presentation.
 */
export type ExecutionPreviewStage = {
  nodeId: string;
  displayLabel: string;
  /**
   * False when `nodeId` could not be matched against the pinned workflow
   * snapshot. The compose engine would then fail the line — surface this
   * up-front in the preview so authors can fix it before send.
   */
  isOnSnapshot: boolean;
};

export type ExecutionPreviewTaskRow = {
  /** Stable line key from the source packet (`PacketTaskLine.lineKey` or `QuoteLocalPacketItem.lineKey`). */
  lineKey: string;
  sortOrder: number;
  title: string;
  sourceKind: "taskDefinition" | "embedded";
  taskDefinitionRef: ExecutionPreviewTaskDefinitionRef | null;
  stage: ExecutionPreviewStage;
  /**
   * Authored completion-requirement kinds present on the task (deduped, in
   * canonical order). For `taskDefinition` rows, sourced from the parsed
   * `TaskDefinition.completionRequirementsJson`. For `embedded` rows, parsed
   * from `embeddedPayloadJson.completionRequirementsJson`. Empty when the
   * task has no authored requirements.
   */
  requirementKinds: CompletionRequirementKind[];
  tierCode: string | null;
};

/**
 * Discriminated union of preview shapes. The renderer should switch on `kind`.
 *
 * - `soldScopeCommercial`: `SOLD_SCOPE` line — commercial-only, no runtime tasks.
 * - `manifestNoPacket`: `MANIFEST` line with neither packet pinned (invariant
 *   violation; the validator catches this on save, but we still render a soft
 *   warning so authors can spot it visually).
 * - `manifestLibrary`: `MANIFEST` line pinned to a `ScopePacketRevision`.
 * - `manifestLocal`: `MANIFEST` line pinned to a `QuoteLocalPacket`.
 *
 * `manifestLibraryMissing` / `manifestLocalMissing` cover the rare case where
 * the pinned packet/revision could not be loaded (e.g. revisited after the
 * row was archived / deleted out from under the line). The UI distinguishes
 * these from "not pinned" so the message can be diagnostic.
 */
export type LineItemExecutionPreviewDto =
  | { kind: "soldScopeCommercial" }
  | { kind: "manifestNoPacket" }
  | { kind: "manifestLibraryMissing"; scopePacketRevisionId: string }
  | { kind: "manifestLocalMissing"; quoteLocalPacketId: string }
  | {
      kind: "manifestLibrary";
      packetKey: string;
      packetName: string;
      revisionId: string;
      revisionNumber: number;
      revisionStatus: ExecutionPreviewRevisionStatus;
      /**
       * True when the pinned revision is the parent packet's latest *PUBLISHED*
       * revision. Lets the UI nudge authors who are pinned to an older revision.
       */
      revisionIsLatest: boolean;
      tasks: ExecutionPreviewTaskRow[];
    }
  | {
      kind: "manifestLocal";
      quoteLocalPacketId: string;
      packetName: string;
      tasks: ExecutionPreviewTaskRow[];
    };

/* ------------------------------------------------------------------------------------ */
/* Inputs                                                                                */
/* ------------------------------------------------------------------------------------ */

/**
 * Subset of `ScopePacketRevisionDetailDto` consumed by the projection. Defined
 * structurally so tests can construct it without dragging Prisma into the
 * pure module's dependency graph. The server loader supplies the real DTO
 * via duck-typing.
 */
export type LibraryRevisionForPreview = {
  packetKey: string;
  packetDisplayName: string;
  revision: {
    id: string;
    revisionNumber: number;
    status: ExecutionPreviewRevisionStatus;
  };
  packetTaskLines: ReadonlyArray<{
    lineKey: string;
    sortOrder: number;
    tierCode: string | null;
    targetNodeKey: string;
    taskDefinition: ExecutionPreviewTaskDefinitionRef | null;
    embeddedPayloadJson: unknown;
  }>;
};

/** Subset of `QuoteLocalPacketDto` consumed by the projection. */
export type LocalPacketForPreview = {
  id: string;
  displayName: string;
  items: ReadonlyArray<{
    lineKey: string;
    sortOrder: number;
    tierCode: string | null;
    targetNodeKey: string;
    taskDefinition: ExecutionPreviewTaskDefinitionRef | null;
    embeddedPayloadJson: unknown;
  }>;
};

export type LineItemExecutionPreviewInput = {
  executionMode: string;
  scopePacketRevisionId: string | null;
  quoteLocalPacketId: string | null;
  /** Resolved by the loader from `scopePacketRevisionId`; null when not library-pinned or not found. */
  libraryRevision: LibraryRevisionForPreview | null;
  /** Resolved by the loader from `quoteLocalPacketId`; null when not local-pinned or not found. */
  localPacket: LocalPacketForPreview | null;
  /**
   * Latest published revision id of the line's parent packet, or null when
   * the parent packet has no published revisions yet. Used solely for the
   * `revisionIsLatest` flag on `manifestLibrary`.
   */
  parentPacketLatestPublishedRevisionId: string | null;
  /** Empty when no workflow is pinned. Stage labels degrade to humanized ids. */
  workflowNodeKeys: ReadonlyArray<WorkflowNodeKeyProjection>;
  /**
   * Pre-fetched `TaskDefinition.completionRequirements` keyed by id. The loader
   * batches these for all task definitions referenced by the quote's packets.
   * Missing entries (e.g. archived / inaccessible defs) project as empty
   * requirement lists rather than throwing.
   */
  taskDefinitionRequirementsById: ReadonlyMap<string, CompletionRequirement[]>;
};

/* ------------------------------------------------------------------------------------ */
/* Internals                                                                             */
/* ------------------------------------------------------------------------------------ */

function readEmbeddedJson(json: unknown): {
  title?: string;
  completionRequirementsJson?: unknown;
} {
  if (json === null || typeof json !== "object" || Array.isArray(json)) return {};
  const o = json as Record<string, unknown>;
  return {
    title: typeof o.title === "string" ? o.title : undefined,
    completionRequirementsJson: o.completionRequirementsJson,
  };
}

function projectStage(
  targetNodeKey: string,
  nodeKeys: ReadonlyArray<WorkflowNodeKeyProjection>,
): ExecutionPreviewStage {
  const match = nodeKeys.find((n) => n.nodeId === targetNodeKey);
  const fallback = humanizeWorkflowNodeId(targetNodeKey);
  return {
    nodeId: targetNodeKey,
    // Use the snapshot's authored displayName when present, otherwise the
    // humanized form of the raw id. The raw `nodeId` is always still
    // surfaced separately by the renderer so technical reviewers can confirm
    // the compose binding.
    displayLabel: match?.displayName ?? (fallback === "" ? targetNodeKey : fallback),
    isOnSnapshot: match != null,
  };
}

function projectRequirementKinds(
  taskLine: { taskDefinition: ExecutionPreviewTaskDefinitionRef | null; embeddedPayloadJson: unknown },
  taskDefinitionRequirementsById: ReadonlyMap<string, CompletionRequirement[]>,
): CompletionRequirementKind[] {
  let reqs: CompletionRequirement[] | undefined;
  if (taskLine.taskDefinition) {
    reqs = taskDefinitionRequirementsById.get(taskLine.taskDefinition.id);
  } else {
    const embedded = readEmbeddedJson(taskLine.embeddedPayloadJson);
    const parsed = parseCompletionRequirements(embedded.completionRequirementsJson ?? null);
    if (parsed.ok) reqs = parsed.value;
  }
  if (!reqs || reqs.length === 0) return [];
  // Preserve canonical kind order for stable, deterministic display.
  const present = new Set(reqs.map((r) => r.kind));
  return COMPLETION_REQUIREMENT_KINDS.filter((k) => present.has(k));
}

function projectTitle(taskLine: {
  lineKey: string;
  taskDefinition: ExecutionPreviewTaskDefinitionRef | null;
  embeddedPayloadJson: unknown;
}): string {
  if (taskLine.taskDefinition) return taskLine.taskDefinition.displayName;
  const embedded = readEmbeddedJson(taskLine.embeddedPayloadJson);
  if (embedded.title) {
    const trimmed = embedded.title.trim();
    if (trimmed !== "") return trimmed;
  }
  return taskLine.lineKey;
}

function projectTaskRow(
  taskLine: {
    lineKey: string;
    sortOrder: number;
    tierCode: string | null;
    targetNodeKey: string;
    taskDefinition: ExecutionPreviewTaskDefinitionRef | null;
    embeddedPayloadJson: unknown;
  },
  workflowNodeKeys: ReadonlyArray<WorkflowNodeKeyProjection>,
  taskDefinitionRequirementsById: ReadonlyMap<string, CompletionRequirement[]>,
): ExecutionPreviewTaskRow {
  return {
    lineKey: taskLine.lineKey,
    sortOrder: taskLine.sortOrder,
    title: projectTitle(taskLine),
    sourceKind: taskLine.taskDefinition ? "taskDefinition" : "embedded",
    taskDefinitionRef: taskLine.taskDefinition,
    stage: projectStage(taskLine.targetNodeKey, workflowNodeKeys),
    requirementKinds: projectRequirementKinds(taskLine, taskDefinitionRequirementsById),
    tierCode: taskLine.tierCode,
  };
}

function compareTaskRows(
  a: { sortOrder: number; lineKey: string },
  b: { sortOrder: number; lineKey: string },
): number {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  if (a.lineKey < b.lineKey) return -1;
  if (a.lineKey > b.lineKey) return 1;
  return 0;
}

/* ------------------------------------------------------------------------------------ */
/* Entry point                                                                           */
/* ------------------------------------------------------------------------------------ */

/**
 * Project a single line item into its read-only execution preview shape.
 *
 * This function is total — it never throws. Missing/inconsistent inputs
 * project to a `manifestLibraryMissing` / `manifestLocalMissing` /
 * `manifestNoPacket` shape so the UI can show a diagnostic message rather
 * than crash.
 */
export function projectLineItemExecutionPreview(
  input: LineItemExecutionPreviewInput,
): LineItemExecutionPreviewDto {
  if (input.executionMode === "SOLD_SCOPE") {
    return { kind: "soldScopeCommercial" };
  }

  // MANIFEST branch: prefer library pin (XOR-enforced server-side, but we still
  // tolerate a corrupted dual-pin defensively by giving the library precedence).
  if (input.scopePacketRevisionId) {
    if (!input.libraryRevision) {
      return { kind: "manifestLibraryMissing", scopePacketRevisionId: input.scopePacketRevisionId };
    }
    const tasks = input.libraryRevision.packetTaskLines
      .slice()
      .sort(compareTaskRows)
      .map((tl) =>
        projectTaskRow(tl, input.workflowNodeKeys, input.taskDefinitionRequirementsById),
      );
    return {
      kind: "manifestLibrary",
      packetKey: input.libraryRevision.packetKey,
      packetName: input.libraryRevision.packetDisplayName,
      revisionId: input.libraryRevision.revision.id,
      revisionNumber: input.libraryRevision.revision.revisionNumber,
      revisionStatus: input.libraryRevision.revision.status,
      revisionIsLatest:
        input.parentPacketLatestPublishedRevisionId != null &&
        input.parentPacketLatestPublishedRevisionId === input.libraryRevision.revision.id,
      tasks,
    };
  }

  if (input.quoteLocalPacketId) {
    if (!input.localPacket) {
      return { kind: "manifestLocalMissing", quoteLocalPacketId: input.quoteLocalPacketId };
    }
    const tasks = input.localPacket.items
      .slice()
      .sort(compareTaskRows)
      .map((it) =>
        projectTaskRow(it, input.workflowNodeKeys, input.taskDefinitionRequirementsById),
      );
    return {
      kind: "manifestLocal",
      quoteLocalPacketId: input.localPacket.id,
      packetName: input.localPacket.displayName,
      tasks,
    };
  }

  return { kind: "manifestNoPacket" };
}

/* ------------------------------------------------------------------------------------ */
/* Compact summary                                                                       */
/* ------------------------------------------------------------------------------------ */

/**
 * One-line summary of an execution preview's tasks for the scope authoring UI:
 *
 *   "Creates 4 tasks across Site Survey → Install → Commissioning"
 *
 * Behavior:
 *   - Stage labels are taken from `task.stage.displayLabel` (already humanized
 *     by `projectStage` against the pinned snapshot when available).
 *   - Repeated stages are deduped *in first-seen order*, so a task list of
 *     [survey, survey, install, install, closeout] renders as
 *     "Site Survey → Install → Closeout".
 *   - Empty preview (`tasks.length === 0`) returns "0 crew tasks" — the
 *     caller decides whether to render it (we already render an explicit
 *     "no work yet" note for empty templates, so callers typically skip
 *     this string in that case).
 *   - Pure: only depends on the tasks array; no I/O, no side effects.
 *   - Stable order: relies on the projection's task sort (sortOrder, lineKey),
 *     so stage order is deterministic for any given template.
 */
export function buildExecutionPreviewSummary(
  tasks: ReadonlyArray<{ stage: { displayLabel: string } }>,
): string {
  const taskCount = tasks.length;
  const taskWord = taskCount === 1 ? "crew task" : "crew tasks";

  const seen = new Set<string>();
  const stages: string[] = [];
  for (const t of tasks) {
    const label = t.stage.displayLabel;
    if (label === "" || seen.has(label)) continue;
    seen.add(label);
    stages.push(label);
  }

  if (stages.length === 0) {
    return `${taskCount} ${taskWord}`;
  }
  return `${taskCount} ${taskWord} — at ${stages.join(" → ")}`;
}
