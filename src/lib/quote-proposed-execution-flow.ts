/**
 * Pure aggregator: build the "Proposed Execution Flow" view from the
 * already-projected per-line execution previews.
 *
 * Path B / Triangle Mode product direction:
 *   - Stages organize the work; the user authors line items + task packets.
 *   - We never ask the operator to pick a "process template" — the canonical
 *     workflow is auto-pinned in the backend (see `ensure-canonical-workflow-version`).
 *   - This file is the read-only projection that powers the "Review Proposed
 *     Execution Flow" panel that replaces the old "Pin Process Template" UX.
 *
 * Important constraints:
 *   - This is not the compose engine. It does not validate quantity, tier
 *     filters, or compose-time errors. Compose remains the source of truth
 *     at send/freeze (see `compose-engine.ts`).
 *   - It is pure: no I/O, no React imports, no Prisma. All the data it needs
 *     is already produced by `loadLineItemExecutionPreviewsForTenant` and
 *     `projectLineItemExecutionPreview`.
 *   - It groups tasks by *canonical execution stage* (pre-work, design,
 *     permitting, install, final-inspection, closeout). Tasks whose
 *     `targetNodeKey` is not canonical are bucketed under an `"other"` group
 *     so the operator can still see and triage them.
 */

import {
  CANONICAL_EXECUTION_STAGES,
  CANONICAL_STAGE_KEYS,
  isCanonicalExecutionStageKey,
  type CanonicalExecutionStageKey,
} from "./canonical-execution-stages";
import type {
  ExecutionPreviewTaskRow,
  LineItemExecutionPreviewDto,
} from "./quote-line-item-execution-preview";

/* ------------------------------------------------------------------ */
/* Inputs                                                              */
/* ------------------------------------------------------------------ */

/** One quote line item paired with its already-projected per-line preview. */
export type ProposedExecutionFlowLineInput = {
  lineItemId: string;
  /** Display title from the QuoteLineItem (e.g. "10kW solar install"). Optional; falls back to packet name. */
  lineTitle?: string | null;
  preview: LineItemExecutionPreviewDto;
};

/* ------------------------------------------------------------------ */
/* Outputs                                                             */
/* ------------------------------------------------------------------ */

/** Pseudo-stage bucket key used for tasks whose nodeId is not canonical. */
export const NON_CANONICAL_STAGE_KEY = "other" as const;
export type ProposedExecutionFlowStageKey =
  | CanonicalExecutionStageKey
  | typeof NON_CANONICAL_STAGE_KEY;

/** A single task row inside a stage, lifted from its source line item. */
export type ProposedExecutionFlowTask = {
  lineItemId: string;
  lineTitle: string | null;
  /** The packet display name (library or local) the task came from. Null for diagnostic shapes. */
  sourcePacketName: string | null;
  /** Stable key from the source `PacketTaskLine` / `QuoteLocalPacketItem`. */
  lineKey: string;
  sortOrder: number;
  title: string;
  sourceKind: ExecutionPreviewTaskRow["sourceKind"];
  /** Raw nodeId on the task. May not be canonical and may be off-snapshot. */
  nodeId: string;
  stageDisplayLabel: string;
  /** False when nodeId could not be matched against the pinned workflow snapshot. */
  isOnSnapshot: boolean;
  /** False when nodeId is not one of the six canonical stages. */
  isCanonical: boolean;
  requirementKinds: ExecutionPreviewTaskRow["requirementKinds"];
  tierCode: string | null;
};

export type ProposedExecutionFlowStage = {
  key: ProposedExecutionFlowStageKey;
  /** Canonical sortOrder (1-6) for canonical stages, 99 for the "other" bucket. */
  sortOrder: number;
  label: string;
  /** Short canonical description; null for the "other" bucket. */
  description: string | null;
  taskCount: number;
  tasks: ProposedExecutionFlowTask[];
};

/** Per-line warning shapes, lifted from the per-line preview kinds. */
export type ProposedExecutionFlowLineWarning =
  | {
      kind: "missingPacket";
      lineItemId: string;
      lineTitle: string | null;
    }
  | {
      kind: "missingLibraryRevision";
      lineItemId: string;
      lineTitle: string | null;
      scopePacketRevisionId: string;
    }
  | {
      kind: "missingLocalPacket";
      lineItemId: string;
      lineTitle: string | null;
      quoteLocalPacketId: string;
    }
  | {
      kind: "stageOffSnapshot";
      lineItemId: string;
      lineTitle: string | null;
      /** Raw stage key — show only under Advanced / support UI. */
      nodeId: string;
      /** Human-readable stage label from the execution preview. */
      stageDisplayLabel: string;
      taskTitle: string;
    }
  | {
      kind: "stageNonCanonical";
      lineItemId: string;
      lineTitle: string | null;
      /** Raw stage key — show only under Advanced / support UI. */
      nodeId: string;
      stageDisplayLabel: string;
      taskTitle: string;
    }
  | {
      kind: "executionFlowBinding";
      /** System / binding state — not a line-authoring defect. */
      detail: string;
    };

/** User-facing copy when the bound workflow exposes no stage nodes (unbound or empty snapshot). */
export const EXECUTION_FLOW_BINDING_SYSTEM_MESSAGE =
  "Execution flow is not bound yet. The system needs to bind this draft to the standard execution stages.";

export type ProposedExecutionFlowSummary = {
  /** Total quoted line items considered (input length). */
  quotedLineCount: number;
  /** Number of MANIFEST lines that resolved to a packet (library or local). */
  packetCount: number;
  /** Total runtime tasks the proposed plan would generate (sum across all stages). */
  generatedTaskCount: number;
  /** Lines that are sold-only (commercial — won't generate crew work). */
  soldScopeOnlyCount: number;
  /**
   * Number of MANIFEST lines that resolve cleanly to a packet AND have no
   * off-snapshot or non-canonical stage warnings. Equivalent to the same
   * "ok" semantic that `derivePacketStageReadiness` exposes.
   */
  okManifestLineCount: number;
  /** Number of MANIFEST lines with at least one issue (counts each line once). */
  manifestLinesWithIssuesCount: number;
};

export type ProposedExecutionFlow = {
  summary: ProposedExecutionFlowSummary;
  /**
   * Stages in canonical order, then `"other"` last when present. By default,
   * this list contains *only stages that have at least one task*; callers
   * that want to render every canonical stage (including empties) can pass
   * `{ includeEmptyCanonicalStages: true }` to `buildProposedExecutionFlow`.
   */
  stages: ProposedExecutionFlowStage[];
  warnings: ProposedExecutionFlowLineWarning[];
  /**
   * When true, do not show per-task OFF-STAGE badges for `!isOnSnapshot` —
   * the failure mode is missing/empty bound workflow nodes, not bad packet stages.
   */
  suppressPerTaskOffStageBadges: boolean;
};

export type BuildProposedExecutionFlowOptions = {
  /**
   * When true, every canonical stage row is included in `stages` even if it
   * has zero tasks. Defaults to false (empty canonical stages hidden).
   * The `"other"` bucket is never included when empty regardless of this
   * option — it's diagnostic-only.
   */
  includeEmptyCanonicalStages?: boolean;
  /**
   * When false, the pinned workflow produced no stage nodes (unbound quote or empty/malformed snapshot).
   * Per-task `stageOffSnapshot` warnings are suppressed and a single `executionFlowBinding` warning is added.
   */
  workflowSnapshotHasStageNodes?: boolean;
};

/* ------------------------------------------------------------------ */
/* Internals                                                           */
/* ------------------------------------------------------------------ */

const NON_CANONICAL_STAGE_LABEL = "Other / off-stage";

function emptyCanonicalStage(key: CanonicalExecutionStageKey): ProposedExecutionFlowStage {
  const stage = CANONICAL_EXECUTION_STAGES[key];
  return {
    key,
    sortOrder: stage.sortOrder,
    label: stage.label,
    description: stage.description,
    taskCount: 0,
    tasks: [],
  };
}

function emptyOtherStage(): ProposedExecutionFlowStage {
  return {
    key: NON_CANONICAL_STAGE_KEY,
    sortOrder: 99,
    label: NON_CANONICAL_STAGE_LABEL,
    description: null,
    taskCount: 0,
    tasks: [],
  };
}

function compareTasks(
  a: { sortOrder: number; lineKey: string },
  b: { sortOrder: number; lineKey: string },
): number {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  if (a.lineKey < b.lineKey) return -1;
  if (a.lineKey > b.lineKey) return 1;
  return 0;
}

function packetNameForPreview(preview: LineItemExecutionPreviewDto): string | null {
  if (preview.kind === "manifestLibrary" || preview.kind === "manifestLocal") {
    return preview.packetName;
  }
  return null;
}

function liftTaskRows(
  line: ProposedExecutionFlowLineInput,
): ProposedExecutionFlowTask[] {
  const preview = line.preview;
  if (preview.kind !== "manifestLibrary" && preview.kind !== "manifestLocal") {
    return [];
  }
  const packetName = packetNameForPreview(preview);
  return preview.tasks.map((t) => ({
    lineItemId: line.lineItemId,
    lineTitle: line.lineTitle ?? null,
    sourcePacketName: packetName,
    lineKey: t.lineKey,
    sortOrder: t.sortOrder,
    title: t.title,
    sourceKind: t.sourceKind,
    nodeId: t.stage.nodeId,
    stageDisplayLabel: t.stage.displayLabel,
    isOnSnapshot: t.stage.isOnSnapshot,
    isCanonical: isCanonicalExecutionStageKey(t.stage.nodeId),
    requirementKinds: t.requirementKinds,
    tierCode: t.tierCode,
  }));
}

function bucketKeyForTask(task: ProposedExecutionFlowTask): ProposedExecutionFlowStageKey {
  return task.isCanonical
    ? (task.nodeId as CanonicalExecutionStageKey)
    : NON_CANONICAL_STAGE_KEY;
}

function collectWarningsForLine(
  line: ProposedExecutionFlowLineInput,
): ProposedExecutionFlowLineWarning[] {
  const preview = line.preview;
  const lineTitle = line.lineTitle ?? null;
  if (preview.kind === "manifestNoPacket") {
    return [{ kind: "missingPacket", lineItemId: line.lineItemId, lineTitle }];
  }
  if (preview.kind === "manifestLibraryMissing") {
    return [
      {
        kind: "missingLibraryRevision",
        lineItemId: line.lineItemId,
        lineTitle,
        scopePacketRevisionId: preview.scopePacketRevisionId,
      },
    ];
  }
  if (preview.kind === "manifestLocalMissing") {
    return [
      {
        kind: "missingLocalPacket",
        lineItemId: line.lineItemId,
        lineTitle,
        quoteLocalPacketId: preview.quoteLocalPacketId,
      },
    ];
  }
  if (preview.kind === "manifestLibrary" || preview.kind === "manifestLocal") {
    const out: ProposedExecutionFlowLineWarning[] = [];
    for (const t of preview.tasks) {
      if (!t.stage.isOnSnapshot) {
        out.push({
          kind: "stageOffSnapshot",
          lineItemId: line.lineItemId,
          lineTitle,
          nodeId: t.stage.nodeId,
          stageDisplayLabel: t.stage.displayLabel,
          taskTitle: t.title,
        });
      } else if (!isCanonicalExecutionStageKey(t.stage.nodeId)) {
        out.push({
          kind: "stageNonCanonical",
          lineItemId: line.lineItemId,
          lineTitle,
          nodeId: t.stage.nodeId,
          stageDisplayLabel: t.stage.displayLabel,
          taskTitle: t.title,
        });
      }
    }
    return out;
  }
  return [];
}

function isManifestKind(kind: LineItemExecutionPreviewDto["kind"]): boolean {
  return (
    kind === "manifestNoPacket" ||
    kind === "manifestLibraryMissing" ||
    kind === "manifestLocalMissing" ||
    kind === "manifestLibrary" ||
    kind === "manifestLocal"
  );
}

/* ------------------------------------------------------------------ */
/* Public entry point                                                  */
/* ------------------------------------------------------------------ */

export function buildProposedExecutionFlow(
  lines: ReadonlyArray<ProposedExecutionFlowLineInput>,
  options: BuildProposedExecutionFlowOptions = {},
): ProposedExecutionFlow {
  const includeEmptyCanonical = options.includeEmptyCanonicalStages === true;
  const workflowSnapshotHasStageNodes = options.workflowSnapshotHasStageNodes !== false;

  // Pre-create the canonical buckets in canonical order so output is stable.
  const canonicalBuckets = new Map<CanonicalExecutionStageKey, ProposedExecutionFlowStage>();
  for (const key of CANONICAL_STAGE_KEYS) {
    canonicalBuckets.set(key, emptyCanonicalStage(key));
  }
  let otherBucket: ProposedExecutionFlowStage | null = null;

  let quotedLineCount = 0;
  let soldScopeOnlyCount = 0;
  let packetCount = 0;
  let generatedTaskCount = 0;
  let manifestLinesWithIssuesCount = 0;
  let okManifestLineCount = 0;
  const warnings: ProposedExecutionFlowLineWarning[] = [];

  for (const line of lines) {
    quotedLineCount += 1;
    const kind = line.preview.kind;

    if (kind === "soldScopeCommercial") {
      soldScopeOnlyCount += 1;
      continue;
    }

    if (!isManifestKind(kind)) {
      continue;
    }

    let lineWarnings = collectWarningsForLine(line);
    if (!workflowSnapshotHasStageNodes) {
      lineWarnings = lineWarnings.filter((w) => w.kind !== "stageOffSnapshot");
    }
    if (lineWarnings.length > 0) {
      warnings.push(...lineWarnings);
      manifestLinesWithIssuesCount += 1;
    } else {
      okManifestLineCount += 1;
    }

    if (kind === "manifestLibrary" || kind === "manifestLocal") {
      packetCount += 1;
      const tasks = liftTaskRows(line);
      generatedTaskCount += tasks.length;
      for (const task of tasks) {
        const bucketKey = bucketKeyForTask(task);
        if (bucketKey === NON_CANONICAL_STAGE_KEY) {
          if (otherBucket == null) otherBucket = emptyOtherStage();
          otherBucket.tasks.push(task);
        } else {
          canonicalBuckets.get(bucketKey)!.tasks.push(task);
        }
      }
    }
  }

  // Sort tasks within each bucket and finalize counts.
  const stages: ProposedExecutionFlowStage[] = [];
  for (const key of CANONICAL_STAGE_KEYS) {
    const bucket = canonicalBuckets.get(key)!;
    bucket.tasks.sort(compareTasks);
    bucket.taskCount = bucket.tasks.length;
    if (bucket.taskCount > 0 || includeEmptyCanonical) {
      stages.push(bucket);
    }
  }
  if (otherBucket != null && otherBucket.tasks.length > 0) {
    otherBucket.tasks.sort(compareTasks);
    otherBucket.taskCount = otherBucket.tasks.length;
    stages.push(otherBucket);
  }

  if (!workflowSnapshotHasStageNodes) {
    warnings.unshift({
      kind: "executionFlowBinding",
      detail: EXECUTION_FLOW_BINDING_SYSTEM_MESSAGE,
    });
  }

  return {
    summary: {
      quotedLineCount,
      packetCount,
      generatedTaskCount,
      soldScopeOnlyCount,
      okManifestLineCount,
      manifestLinesWithIssuesCount,
    },
    stages,
    warnings,
    suppressPerTaskOffStageBadges: !workflowSnapshotHasStageNodes,
  };
}
