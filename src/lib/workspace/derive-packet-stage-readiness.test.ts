import { describe, expect, it } from "vitest";
import {
  derivePacketStageReadiness,
  type PacketStageReadinessLineInput,
} from "./derive-packet-stage-readiness";
import type {
  ExecutionPreviewTaskRow,
  LineItemExecutionPreviewDto,
} from "@/lib/quote-line-item-execution-preview";

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
  over: Partial<Extract<LineItemExecutionPreviewDto, { kind: "manifestLibrary" }>> = {},
): Extract<LineItemExecutionPreviewDto, { kind: "manifestLibrary" }> {
  return {
    kind: "manifestLibrary",
    packetKey: "pkt-key",
    packetName: "Packet Name",
    revisionId: "rev-1",
    revisionNumber: 1,
    revisionStatus: "PUBLISHED",
    revisionIsLatest: true,
    tasks: [...tasks],
    ...over,
  };
}

function manifestLocal(
  tasks: ReadonlyArray<ExecutionPreviewTaskRow> = [],
): Extract<LineItemExecutionPreviewDto, { kind: "manifestLocal" }> {
  return {
    kind: "manifestLocal",
    quoteLocalPacketId: "qlp-1",
    packetName: "Local Packet",
    tasks: [...tasks],
  };
}

function input(id: string, preview: LineItemExecutionPreviewDto): PacketStageReadinessLineInput {
  return { lineItemId: id, preview };
}

describe("derivePacketStageReadiness", () => {
  it("empty input → n/a", () => {
    const r = derivePacketStageReadiness([]);
    expect(r.state).toBe("n/a");
    expect(r.manifestLineCount).toBe(0);
    expect(r.okManifestLineCount).toBe(0);
    expect(r.issues).toEqual([]);
    expect(r.note.toLowerCase()).toContain("crew work");
  });

  it("only sold-scope lines → n/a (commercial-only does not pull state to needs-attention)", () => {
    const r = derivePacketStageReadiness([
      input("li-1", { kind: "soldScopeCommercial" }),
      input("li-2", { kind: "soldScopeCommercial" }),
    ]);
    expect(r.state).toBe("n/a");
    expect(r.manifestLineCount).toBe(0);
  });

  it("all manifest lines OK → yes", () => {
    const r = derivePacketStageReadiness([
      input("li-a", manifestLibrary([task()])),
      input("li-b", manifestLocal([task({ lineKey: "lk-2" })])),
      input("li-c", { kind: "soldScopeCommercial" }),
    ]);
    expect(r.state).toBe("yes");
    expect(r.manifestLineCount).toBe(2);
    expect(r.okManifestLineCount).toBe(2);
    expect(r.issues).toEqual([]);
    expect(r.note).toContain("2 of 2");
  });

  it("manifestNoPacket → no, with issue and copy", () => {
    const r = derivePacketStageReadiness([
      input("li-bad", { kind: "manifestNoPacket" }),
      input("li-ok", manifestLibrary([task()])),
    ]);
    expect(r.state).toBe("no");
    expect(r.manifestLineCount).toBe(2);
    expect(r.okManifestLineCount).toBe(1);
    expect(r.issues).toContainEqual({ kind: "manifestNoPacket", lineItemId: "li-bad" });
    expect(r.note).toContain("no work source attached");
  });

  it("manifestLibraryMissing → no, copy mentions saved work", () => {
    const r = derivePacketStageReadiness([
      input("li-x", { kind: "manifestLibraryMissing", scopePacketRevisionId: "rev-archived" }),
    ]);
    expect(r.state).toBe("no");
    expect(r.issues).toContainEqual({ kind: "manifestLibraryMissing", lineItemId: "li-x" });
    expect(r.note.toLowerCase()).toContain("saved work");
  });

  it("manifestLocalMissing → no, copy mentions custom work on this quote", () => {
    const r = derivePacketStageReadiness([
      input("li-y", { kind: "manifestLocalMissing", quoteLocalPacketId: "qlp-gone" }),
    ]);
    expect(r.state).toBe("no");
    expect(r.issues).toContainEqual({ kind: "manifestLocalMissing", lineItemId: "li-y" });
    expect(r.note.toLowerCase()).toContain("custom work on this quote");
  });

  it("stage off pinned snapshot inside a manifestLibrary → no, with stageOffSnapshot issue", () => {
    const r = derivePacketStageReadiness([
      input(
        "li-z",
        manifestLibrary([
          task({
            lineKey: "lk-on",
            stage: { nodeId: "n-on", displayLabel: "On", isOnSnapshot: true },
          }),
          task({
            lineKey: "lk-off",
            stage: { nodeId: "n-off", displayLabel: "Off", isOnSnapshot: false },
          }),
        ]),
      ),
    ]);
    expect(r.state).toBe("no");
    expect(r.manifestLineCount).toBe(1);
    expect(r.okManifestLineCount).toBe(0);
    expect(r.issues).toContainEqual({
      kind: "stageOffSnapshot",
      lineItemId: "li-z",
      nodeId: "n-off",
    });
    expect(r.note.toLowerCase()).toContain("pinned process template");
  });

  it("workflowSnapshotHasStageNodes false: executionFlowBinding replaces stageOffSnapshot issues", () => {
    const r = derivePacketStageReadiness(
      [
        input(
          "li-z",
          manifestLibrary([
            task({
              lineKey: "lk-off",
              stage: { nodeId: "install", displayLabel: "Install", isOnSnapshot: false },
            }),
          ]),
        ),
      ],
      { workflowSnapshotHasStageNodes: false },
    );
    expect(r.issues.filter((i) => i.kind === "stageOffSnapshot")).toHaveLength(0);
    expect(r.issues.some((i) => i.kind === "executionFlowBinding")).toBe(true);
    expect(r.state).toBe("no");
    expect(r.note.toLowerCase()).toContain("binding");
  });

  it("multi-task line: all stages on snapshot → counts as ok", () => {
    const r = derivePacketStageReadiness([
      input(
        "li-multi",
        manifestLocal([
          task({ lineKey: "a" }),
          task({
            lineKey: "b",
            stage: { nodeId: "n2", displayLabel: "N2", isOnSnapshot: true },
          }),
        ]),
      ),
    ]);
    expect(r.state).toBe("yes");
    expect(r.okManifestLineCount).toBe(1);
    expect(r.issues).toEqual([]);
  });

  it("mixed failures aggregate without double-counting bad lines", () => {
    const r = derivePacketStageReadiness([
      input("li-1", { kind: "manifestNoPacket" }),
      input("li-2", { kind: "manifestLibraryMissing", scopePacketRevisionId: "rev-x" }),
      input(
        "li-3",
        manifestLibrary([
          task({
            lineKey: "lk-off",
            stage: { nodeId: "n-off", displayLabel: "Off", isOnSnapshot: false },
          }),
          task({
            lineKey: "lk-off-2",
            stage: { nodeId: "n-off-2", displayLabel: "Off2", isOnSnapshot: false },
          }),
        ]),
      ),
      input("li-4", manifestLibrary([task()])),
    ]);
    expect(r.state).toBe("no");
    expect(r.manifestLineCount).toBe(4);
    expect(r.okManifestLineCount).toBe(1);
    // 3 bad lines (li-1, li-2, li-3); li-3 produced 2 stageOffSnapshot issues.
    expect(r.note).toContain("3 of 4");
    const stageIssues = r.issues.filter((i) => i.kind === "stageOffSnapshot");
    expect(stageIssues).toHaveLength(2);
  });

  it("avoids raw enum leakage in user-facing note", () => {
    const r = derivePacketStageReadiness([
      input("li-a", { kind: "manifestNoPacket" }),
      input("li-b", { kind: "manifestLibraryMissing", scopePacketRevisionId: "rev-x" }),
    ]);
    expect(r.note).not.toContain("manifestNoPacket");
    expect(r.note).not.toContain("manifestLibraryMissing");
    expect(r.note).not.toContain("MANIFEST");
  });
});
