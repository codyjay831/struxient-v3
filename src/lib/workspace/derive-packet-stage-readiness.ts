/**
 * Pure derivation: aggregate per-line execution preview shapes into a single
 * "field-work lines are stage-ready" signal for the quote workspace
 * readiness sidebar.
 *
 * Triangle Mode canon (visibility/readiness slice):
 *   - This is observation only. Compose remains the source of truth at
 *     send/freeze. We do not duplicate compose logic; we re-use the same
 *     `LineItemExecutionPreviewDto` the scope editor already shows so the
 *     readiness signal cannot diverge from what the user sees per row.
 *   - We never make readiness *more permissive* than send/freeze. Any
 *     `kind` the preview surfaces as a packet/stage problem maps to
 *     `state: "no"`. Lines compose / send may additionally fail on
 *     conditions this projection doesn't model (e.g. compose-time errors);
 *     this readiness row therefore claims only what it can verify, and the
 *     existing honesty notes in `deriveQuoteHeadWorkspaceReadiness` already
 *     teach that send re-runs compose server-side.
 *
 * Counted as "MANIFEST" for the purposes of this signal:
 *   - Any line whose preview kind is one of the MANIFEST shapes:
 *     `manifestNoPacket | manifestLibraryMissing | manifestLocalMissing |
 *      manifestLibrary | manifestLocal`.
 *   - `soldScopeCommercial` lines are counted as N/A (commercial-only) and
 *     do not pull the signal into "needs attention".
 */

import type { LineItemExecutionPreviewDto } from "@/lib/quote-line-item-execution-preview";

/** One line item paired with its already-projected execution preview. */
export type PacketStageReadinessLineInput = {
  lineItemId: string;
  preview: LineItemExecutionPreviewDto;
};

/**
 * What the readiness consumer needs to render a checklist row plus optional
 * sub-detail. Issues are kept concrete (small enum + ids) so a future UI
 * can deep-link to the specific failing line. The base copy uses
 * user-facing language; raw `LineItemExecutionPreviewDto.kind` strings stay
 * in `issues[].kind` for any deeper diagnostic affordance, but the `note`
 * itself avoids enum leakage.
 */
export type PacketStageReadinessIssue =
  | { kind: "manifestNoPacket"; lineItemId: string }
  | { kind: "manifestLibraryMissing"; lineItemId: string }
  | { kind: "manifestLocalMissing"; lineItemId: string }
  | { kind: "stageOffSnapshot"; lineItemId: string; nodeId: string };

export type PacketStageReadiness = {
  /**
   * - `"yes"`: at least one MANIFEST line is present and *every* MANIFEST
   *   line is OK (packet present + every task's stage resolves on the
   *   pinned snapshot).
   * - `"no"`: at least one MANIFEST line has a packet/stage problem.
   * - `"n/a"`: zero MANIFEST lines (only `soldScopeCommercial` or empty
   *   list). Rendered separately by the workspace UI as informational.
   */
  state: "yes" | "no" | "n/a";
  manifestLineCount: number;
  okManifestLineCount: number;
  issues: PacketStageReadinessIssue[];
  /** User-facing note suitable for a checklist sub-line. Never empty. */
  note: string;
};

/* ------------------------------------------------------------------ */
/* Internals                                                           */
/* ------------------------------------------------------------------ */

function isManifestKind(kind: LineItemExecutionPreviewDto["kind"]): boolean {
  return (
    kind === "manifestNoPacket" ||
    kind === "manifestLibraryMissing" ||
    kind === "manifestLocalMissing" ||
    kind === "manifestLibrary" ||
    kind === "manifestLocal"
  );
}

function collectIssuesForLine(
  lineItemId: string,
  preview: LineItemExecutionPreviewDto,
): PacketStageReadinessIssue[] {
  if (preview.kind === "manifestNoPacket") {
    return [{ kind: "manifestNoPacket", lineItemId }];
  }
  if (preview.kind === "manifestLibraryMissing") {
    return [{ kind: "manifestLibraryMissing", lineItemId }];
  }
  if (preview.kind === "manifestLocalMissing") {
    return [{ kind: "manifestLocalMissing", lineItemId }];
  }
  if (preview.kind === "manifestLibrary" || preview.kind === "manifestLocal") {
    const out: PacketStageReadinessIssue[] = [];
    for (const t of preview.tasks) {
      if (!t.stage.isOnSnapshot) {
        out.push({ kind: "stageOffSnapshot", lineItemId, nodeId: t.stage.nodeId });
      }
    }
    return out;
  }
  return [];
}

function formatNote(args: {
  manifestLineCount: number;
  okManifestLineCount: number;
  badLineCount: number;
  noPacketCount: number;
  missingLibraryCount: number;
  missingLocalCount: number;
  stageOffSnapshotCount: number;
}): string {
  if (args.manifestLineCount === 0) {
    return "No field-work lines on this draft yet — only commercial / quote-only items.";
  }
  if (args.badLineCount === 0) {
    return `${String(args.okManifestLineCount)} of ${String(args.manifestLineCount)} field-work line(s) resolve to valid packets and stages.`;
  }
  const fragments: string[] = [];
  if (args.noPacketCount > 0) {
    fragments.push(
      `${String(args.noPacketCount)} field-work line(s) have no work template attached`,
    );
  }
  if (args.missingLibraryCount > 0) {
    fragments.push(
      `${String(args.missingLibraryCount)} reference a saved work template that isn't loadable`,
    );
  }
  if (args.missingLocalCount > 0) {
    fragments.push(
      `${String(args.missingLocalCount)} reference one-off work that isn't loadable`,
    );
  }
  if (args.stageOffSnapshotCount > 0) {
    fragments.push(
      `${String(args.stageOffSnapshotCount)} task stage(s) aren't on the pinned process template`,
    );
  }
  return `${String(args.badLineCount)} of ${String(args.manifestLineCount)} field-work line(s) need attention — ${fragments.join("; ")}.`;
}

/* ------------------------------------------------------------------ */
/* Public entry point                                                  */
/* ------------------------------------------------------------------ */

/**
 * Aggregate per-line execution previews into a single readiness signal.
 *
 * Pure: no I/O, no side effects. Order-independent over the input list.
 * Defensive: every line maps to at most a small fixed set of issue rows;
 * a `manifestLibrary`/`manifestLocal` line with N tasks contributes at
 * most N `stageOffSnapshot` issues (one per off-snapshot stage).
 */
export function derivePacketStageReadiness(
  lines: ReadonlyArray<PacketStageReadinessLineInput>,
): PacketStageReadiness {
  let manifestLineCount = 0;
  let okManifestLineCount = 0;
  let noPacketCount = 0;
  let missingLibraryCount = 0;
  let missingLocalCount = 0;
  let stageOffSnapshotLineCount = 0;
  let stageOffSnapshotIssueCount = 0;
  const issues: PacketStageReadinessIssue[] = [];
  let badLineCount = 0;

  for (const line of lines) {
    const kind = line.preview.kind;
    if (!isManifestKind(kind)) continue;
    manifestLineCount += 1;

    const lineIssues = collectIssuesForLine(line.lineItemId, line.preview);
    if (lineIssues.length === 0) {
      okManifestLineCount += 1;
      continue;
    }
    badLineCount += 1;
    let lineHasStageOffSnapshot = false;
    for (const issue of lineIssues) {
      issues.push(issue);
      if (issue.kind === "manifestNoPacket") noPacketCount += 1;
      else if (issue.kind === "manifestLibraryMissing") missingLibraryCount += 1;
      else if (issue.kind === "manifestLocalMissing") missingLocalCount += 1;
      else if (issue.kind === "stageOffSnapshot") {
        stageOffSnapshotIssueCount += 1;
        lineHasStageOffSnapshot = true;
      }
    }
    if (lineHasStageOffSnapshot) stageOffSnapshotLineCount += 1;
  }

  let state: PacketStageReadiness["state"];
  if (manifestLineCount === 0) state = "n/a";
  else if (badLineCount === 0) state = "yes";
  else state = "no";

  const note = formatNote({
    manifestLineCount,
    okManifestLineCount,
    badLineCount,
    noPacketCount,
    missingLibraryCount,
    missingLocalCount,
    stageOffSnapshotCount: stageOffSnapshotIssueCount,
  });

  // `stageOffSnapshotLineCount` is reserved for a future UX that wants to
  // show "N lines have off-snapshot stages" rather than "N stages". The
  // current note already conveys both per-stage and per-line totals at
  // their respective granularities; intentionally not exported.
  void stageOffSnapshotLineCount;

  return {
    state,
    manifestLineCount,
    okManifestLineCount,
    issues,
    note,
  };
}
