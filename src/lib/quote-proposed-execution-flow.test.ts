import { describe, expect, it } from "vitest";
import {
  buildProposedExecutionFlow,
  NON_CANONICAL_STAGE_KEY,
  type ProposedExecutionFlowLineInput,
} from "./quote-proposed-execution-flow";
import type {
  ExecutionPreviewTaskRow,
  LineItemExecutionPreviewDto,
} from "./quote-line-item-execution-preview";

function task(over: Partial<ExecutionPreviewTaskRow> = {}): ExecutionPreviewTaskRow {
  return {
    lineKey: "lk-1",
    sortOrder: 1,
    title: "Install RTU",
    sourceKind: "embedded",
    taskDefinitionRef: null,
    stage: { nodeId: "install", displayLabel: "Install", isOnSnapshot: true },
    requirementKinds: [],
    tierCode: null,
    ...over,
  };
}

function manifestLibrary(
  tasks: ReadonlyArray<ExecutionPreviewTaskRow> = [],
  packetName = "Packet Name",
): Extract<LineItemExecutionPreviewDto, { kind: "manifestLibrary" }> {
  return {
    kind: "manifestLibrary",
    packetKey: "pkt-key",
    packetName,
    revisionId: "rev-1",
    revisionNumber: 1,
    revisionStatus: "PUBLISHED",
    revisionIsLatest: true,
    tasks: [...tasks],
  };
}

function manifestLocal(
  tasks: ReadonlyArray<ExecutionPreviewTaskRow> = [],
  packetName = "Local Packet",
): Extract<LineItemExecutionPreviewDto, { kind: "manifestLocal" }> {
  return {
    kind: "manifestLocal",
    quoteLocalPacketId: "qlp-1",
    packetName,
    tasks: [...tasks],
  };
}

function line(
  id: string,
  preview: LineItemExecutionPreviewDto,
  lineTitle: string | null = null,
): ProposedExecutionFlowLineInput {
  return { lineItemId: id, preview, lineTitle };
}

describe("buildProposedExecutionFlow", () => {
  it("empty input produces zeroed summary and no stages", () => {
    const r = buildProposedExecutionFlow([]);
    expect(r.summary.quotedLineCount).toBe(0);
    expect(r.summary.packetCount).toBe(0);
    expect(r.summary.generatedTaskCount).toBe(0);
    expect(r.summary.soldScopeOnlyCount).toBe(0);
    expect(r.stages).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.suppressPerTaskOffStageBadges).toBe(false);
  });

  it("only sold-scope lines: counts but no stages", () => {
    const r = buildProposedExecutionFlow([
      line("li-1", { kind: "soldScopeCommercial" }, "Allowance"),
      line("li-2", { kind: "soldScopeCommercial" }, "Misc"),
    ]);
    expect(r.summary.quotedLineCount).toBe(2);
    expect(r.summary.soldScopeOnlyCount).toBe(2);
    expect(r.summary.packetCount).toBe(0);
    expect(r.summary.generatedTaskCount).toBe(0);
    expect(r.stages).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it("groups library + local tasks by canonical stage in canonical order", () => {
    const r = buildProposedExecutionFlow([
      line(
        "li-design",
        manifestLibrary([
          task({
            lineKey: "lk-design",
            title: "CAD plans",
            stage: { nodeId: "design", displayLabel: "Design", isOnSnapshot: true },
          }),
        ]),
      ),
      line(
        "li-install",
        manifestLocal([
          task({
            lineKey: "lk-install-1",
            title: "Mount unit",
            stage: { nodeId: "install", displayLabel: "Install", isOnSnapshot: true },
          }),
          task({
            lineKey: "lk-pre",
            sortOrder: 0,
            title: "Site visit",
            stage: { nodeId: "pre-work", displayLabel: "Pre-work", isOnSnapshot: true },
          }),
        ]),
      ),
    ]);
    expect(r.stages.map((s) => s.key)).toEqual(["pre-work", "design", "install"]);
    expect(r.stages[0]!.taskCount).toBe(1);
    expect(r.stages[1]!.taskCount).toBe(1);
    expect(r.stages[2]!.taskCount).toBe(1);
    expect(r.summary.generatedTaskCount).toBe(3);
    expect(r.summary.packetCount).toBe(2);
    expect(r.summary.okManifestLineCount).toBe(2);
    expect(r.warnings).toEqual([]);
  });

  it("sorts tasks within a stage by sortOrder, then lineKey", () => {
    const r = buildProposedExecutionFlow([
      line(
        "li-x",
        manifestLibrary([
          task({ lineKey: "b", sortOrder: 2, title: "B" }),
          task({ lineKey: "a", sortOrder: 1, title: "A" }),
          task({ lineKey: "c", sortOrder: 1, title: "C" }),
        ]),
      ),
    ]);
    expect(r.stages.map((s) => s.tasks.map((t) => t.lineKey))).toEqual([
      ["a", "c", "b"],
    ]);
  });

  it("hides empty canonical stages by default", () => {
    const r = buildProposedExecutionFlow([
      line(
        "li-only-install",
        manifestLibrary([
          task({ lineKey: "lk-1", stage: { nodeId: "install", displayLabel: "Install", isOnSnapshot: true } }),
        ]),
      ),
    ]);
    expect(r.stages.map((s) => s.key)).toEqual(["install"]);
  });

  it("includeEmptyCanonicalStages: true returns all six canonical stages even when empty", () => {
    const r = buildProposedExecutionFlow(
      [
        line(
          "li-only-install",
          manifestLibrary([
            task({
              lineKey: "lk-1",
              stage: { nodeId: "install", displayLabel: "Install", isOnSnapshot: true },
            }),
          ]),
        ),
      ],
      { includeEmptyCanonicalStages: true },
    );
    expect(r.stages.map((s) => s.key)).toEqual([
      "pre-work",
      "design",
      "permitting",
      "install",
      "final-inspection",
      "closeout",
    ]);
    expect(r.stages.find((s) => s.key === "install")!.taskCount).toBe(1);
    expect(r.stages.find((s) => s.key === "design")!.taskCount).toBe(0);
  });

  it("manifestNoPacket → missingPacket warning, no tasks generated", () => {
    const r = buildProposedExecutionFlow([
      line("li-bad", { kind: "manifestNoPacket" }, "Field-only line"),
      line(
        "li-ok",
        manifestLibrary([
          task({ lineKey: "lk-1", stage: { nodeId: "install", displayLabel: "Install", isOnSnapshot: true } }),
        ]),
      ),
    ]);
    expect(r.summary.manifestLinesWithIssuesCount).toBe(1);
    expect(r.summary.okManifestLineCount).toBe(1);
    expect(r.summary.packetCount).toBe(1);
    expect(r.warnings).toContainEqual({
      kind: "missingPacket",
      lineItemId: "li-bad",
      lineTitle: "Field-only line",
    });
  });

  it("manifestLibraryMissing → missingLibraryRevision warning carries the revision id", () => {
    const r = buildProposedExecutionFlow([
      line(
        "li-x",
        { kind: "manifestLibraryMissing", scopePacketRevisionId: "rev-archived" },
        "Archived line",
      ),
    ]);
    expect(r.warnings).toContainEqual({
      kind: "missingLibraryRevision",
      lineItemId: "li-x",
      lineTitle: "Archived line",
      scopePacketRevisionId: "rev-archived",
    });
    expect(r.summary.manifestLinesWithIssuesCount).toBe(1);
    expect(r.summary.packetCount).toBe(0);
  });

  it("manifestLocalMissing → missingLocalPacket warning carries the packet id", () => {
    const r = buildProposedExecutionFlow([
      line(
        "li-y",
        { kind: "manifestLocalMissing", quoteLocalPacketId: "qlp-gone" },
        "Detached line",
      ),
    ]);
    expect(r.warnings).toContainEqual({
      kind: "missingLocalPacket",
      lineItemId: "li-y",
      lineTitle: "Detached line",
      quoteLocalPacketId: "qlp-gone",
    });
  });

  it("off-snapshot stage emits stageOffSnapshot warning and counts the line as needing attention", () => {
    const r = buildProposedExecutionFlow([
      line(
        "li-z",
        manifestLibrary([
          task({
            lineKey: "lk-on",
            stage: { nodeId: "install", displayLabel: "Install", isOnSnapshot: true },
          }),
          task({
            lineKey: "lk-off",
            title: "Stranded task",
            stage: { nodeId: "legacy-node", displayLabel: "Legacy Node", isOnSnapshot: false },
          }),
        ]),
      ),
    ]);
    expect(r.warnings).toContainEqual({
      kind: "stageOffSnapshot",
      lineItemId: "li-z",
      lineTitle: null,
      nodeId: "legacy-node",
      taskTitle: "Stranded task",
    });
    expect(r.summary.manifestLinesWithIssuesCount).toBe(1);
    expect(r.summary.okManifestLineCount).toBe(0);
  });

  it("workflowSnapshotHasStageNodes false: one binding warning, no per-task stageOffSnapshot", () => {
    const r = buildProposedExecutionFlow(
      [
        line(
          "li-z",
          manifestLibrary([
            task({
              lineKey: "lk-1",
              stage: { nodeId: "install", displayLabel: "Install", isOnSnapshot: false },
            }),
          ]),
        ),
      ],
      { workflowSnapshotHasStageNodes: false },
    );
    expect(r.warnings.some((w) => w.kind === "stageOffSnapshot")).toBe(false);
    expect(r.warnings.some((w) => w.kind === "executionFlowBinding")).toBe(true);
    expect(r.suppressPerTaskOffStageBadges).toBe(true);
  });

  it("non-canonical (but on-snapshot) stage routes the task into the 'other' bucket and emits a warning", () => {
    const r = buildProposedExecutionFlow([
      line(
        "li-other",
        manifestLibrary([
          task({
            lineKey: "lk-other",
            title: "Custom step",
            stage: { nodeId: "custom-stage", displayLabel: "Custom Stage", isOnSnapshot: true },
          }),
        ]),
      ),
    ]);
    expect(r.stages.map((s) => s.key)).toEqual([NON_CANONICAL_STAGE_KEY]);
    expect(r.stages[0]!.tasks).toHaveLength(1);
    expect(r.warnings).toContainEqual({
      kind: "stageNonCanonical",
      lineItemId: "li-other",
      lineTitle: null,
      nodeId: "custom-stage",
      taskTitle: "Custom step",
    });
  });

  it("'other' bucket is hidden when empty, even with includeEmptyCanonicalStages", () => {
    const r = buildProposedExecutionFlow(
      [
        line(
          "li-only-install",
          manifestLibrary([
            task({
              lineKey: "lk-1",
              stage: { nodeId: "install", displayLabel: "Install", isOnSnapshot: true },
            }),
          ]),
        ),
      ],
      { includeEmptyCanonicalStages: true },
    );
    expect(r.stages.map((s) => s.key)).not.toContain(NON_CANONICAL_STAGE_KEY);
  });

  it("propagates packet name and line title onto each lifted task", () => {
    const r = buildProposedExecutionFlow([
      line(
        "li-1",
        manifestLibrary(
          [
            task({
              lineKey: "lk-design",
              title: "CAD",
              stage: { nodeId: "design", displayLabel: "Design", isOnSnapshot: true },
            }),
          ],
          "Engineering Pack",
        ),
        "10kW solar install",
      ),
    ]);
    const t = r.stages[0]!.tasks[0]!;
    expect(t.lineItemId).toBe("li-1");
    expect(t.lineTitle).toBe("10kW solar install");
    expect(t.sourcePacketName).toBe("Engineering Pack");
    expect(t.title).toBe("CAD");
    expect(t.stageDisplayLabel).toBe("Design");
    expect(t.isCanonical).toBe(true);
    expect(t.isOnSnapshot).toBe(true);
  });

  it("aggregates summary counts across mixed shapes correctly", () => {
    const r = buildProposedExecutionFlow([
      line("li-1", { kind: "soldScopeCommercial" }),
      line("li-2", { kind: "manifestNoPacket" }),
      line(
        "li-3",
        manifestLibrary([
          task({ lineKey: "lk-a", stage: { nodeId: "install", displayLabel: "Install", isOnSnapshot: true } }),
          task({ lineKey: "lk-b", stage: { nodeId: "install", displayLabel: "Install", isOnSnapshot: true } }),
        ]),
      ),
      line(
        "li-4",
        manifestLocal([
          task({ lineKey: "lk-c", stage: { nodeId: "closeout", displayLabel: "Closeout", isOnSnapshot: true } }),
        ]),
      ),
    ]);
    expect(r.summary.quotedLineCount).toBe(4);
    expect(r.summary.soldScopeOnlyCount).toBe(1);
    expect(r.summary.packetCount).toBe(2);
    expect(r.summary.generatedTaskCount).toBe(3);
    expect(r.summary.okManifestLineCount).toBe(2);
    expect(r.summary.manifestLinesWithIssuesCount).toBe(1);
    expect(r.stages.map((s) => s.key)).toEqual(["install", "closeout"]);
  });
});
