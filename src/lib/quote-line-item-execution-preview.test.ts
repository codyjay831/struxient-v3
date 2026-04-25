import { describe, expect, it } from "vitest";
import {
  buildExecutionPreviewSummary,
  projectLineItemExecutionPreview,
  type LibraryRevisionForPreview,
  type LineItemExecutionPreviewInput,
  type LocalPacketForPreview,
} from "./quote-line-item-execution-preview";
import type { CompletionRequirement } from "./task-definition-authored-requirements";
import type { WorkflowNodeKeyProjection } from "./workflow-snapshot-node-projection";

const EMPTY_NODE_KEYS: WorkflowNodeKeyProjection[] = [];
const EMPTY_DEF_REQS = new Map<string, CompletionRequirement[]>();

function baseInput(
  overrides: Partial<LineItemExecutionPreviewInput> = {},
): LineItemExecutionPreviewInput {
  return {
    executionMode: "MANIFEST",
    scopePacketRevisionId: null,
    quoteLocalPacketId: null,
    libraryRevision: null,
    localPacket: null,
    parentPacketLatestPublishedRevisionId: null,
    workflowNodeKeys: EMPTY_NODE_KEYS,
    taskDefinitionRequirementsById: EMPTY_DEF_REQS,
    ...overrides,
  };
}

function libraryRevision(
  overrides: Partial<LibraryRevisionForPreview> = {},
): LibraryRevisionForPreview {
  return {
    packetKey: "pkt-key",
    packetDisplayName: "Packet display",
    revision: { id: "rev-1", revisionNumber: 3, status: "PUBLISHED" },
    packetTaskLines: [],
    ...overrides,
  };
}

function localPacket(overrides: Partial<LocalPacketForPreview> = {}): LocalPacketForPreview {
  return {
    id: "qlp-1",
    displayName: "Local packet",
    items: [],
    ...overrides,
  };
}

describe("projectLineItemExecutionPreview", () => {
  it("returns soldScopeCommercial for SOLD_SCOPE lines regardless of pinned ids", () => {
    // SOLD_SCOPE shorts past packet resolution — even a corrupted dual-pin
    // (which the server-side invariant would reject) collapses to commercial-only.
    const out = projectLineItemExecutionPreview(
      baseInput({
        executionMode: "SOLD_SCOPE",
        scopePacketRevisionId: "rev-x",
        quoteLocalPacketId: "qlp-x",
      }),
    );
    expect(out).toEqual({ kind: "soldScopeCommercial" });
  });

  it("returns manifestNoPacket when MANIFEST line has no pins", () => {
    const out = projectLineItemExecutionPreview(baseInput());
    expect(out).toEqual({ kind: "manifestNoPacket" });
  });

  it("returns manifestLibraryMissing when revision id is set but detail wasn't loaded", () => {
    const out = projectLineItemExecutionPreview(
      baseInput({ scopePacketRevisionId: "rev-1", libraryRevision: null }),
    );
    expect(out).toEqual({ kind: "manifestLibraryMissing", scopePacketRevisionId: "rev-1" });
  });

  it("returns manifestLocalMissing when local packet id is set but detail wasn't loaded", () => {
    const out = projectLineItemExecutionPreview(
      baseInput({ quoteLocalPacketId: "qlp-1", localPacket: null }),
    );
    expect(out).toEqual({ kind: "manifestLocalMissing", quoteLocalPacketId: "qlp-1" });
  });

  it("library: preserves canonical kind order from the requirements map", () => {
    const reqs: CompletionRequirement[] = [
      { kind: "note", required: true },
      { kind: "checklist", label: "Lock out", required: true },
      { kind: "measurement", label: "Suction", unit: "psi", required: true },
    ];
    const defReqMap = new Map<string, CompletionRequirement[]>([["td-1", reqs]]);
    const out = projectLineItemExecutionPreview(
      baseInput({
        scopePacketRevisionId: "rev-1",
        libraryRevision: libraryRevision({
          packetTaskLines: [
            {
              lineKey: "a",
              sortOrder: 1,
              tierCode: null,
              targetNodeKey: "install-rooftop-unit",
              taskDefinition: {
                id: "td-1",
                taskKey: "tk-1",
                displayName: "Install RTU",
                status: "PUBLISHED",
              },
              embeddedPayloadJson: null,
            },
          ],
        }),
        taskDefinitionRequirementsById: defReqMap,
      }),
    );
    expect(out.kind).toBe("manifestLibrary");
    if (out.kind !== "manifestLibrary") return;
    expect(out.tasks).toHaveLength(1);
    // canonical order from COMPLETION_REQUIREMENT_KINDS:
    // checklist, measurement, identifier, result, note, attachment
    expect(out.tasks[0].requirementKinds).toEqual(["checklist", "measurement", "note"]);
  });

  it("library: falls back to humanized targetNodeKey when no snapshot match", () => {
    const out = projectLineItemExecutionPreview(
      baseInput({
        scopePacketRevisionId: "rev-1",
        libraryRevision: libraryRevision({
          packetTaskLines: [
            {
              lineKey: "a",
              sortOrder: 1,
              tierCode: null,
              targetNodeKey: "install-rooftop-unit",
              taskDefinition: null,
              embeddedPayloadJson: { title: "Install" },
            },
          ],
        }),
      }),
    );
    if (out.kind !== "manifestLibrary") throw new Error("expected manifestLibrary");
    expect(out.tasks[0].stage).toEqual({
      nodeId: "install-rooftop-unit",
      displayLabel: "Install rooftop unit",
      isOnSnapshot: false,
    });
  });

  it("library: prefers snapshot displayName when available", () => {
    const out = projectLineItemExecutionPreview(
      baseInput({
        scopePacketRevisionId: "rev-1",
        libraryRevision: libraryRevision({
          packetTaskLines: [
            {
              lineKey: "a",
              sortOrder: 1,
              tierCode: null,
              targetNodeKey: "node-7",
              taskDefinition: null,
              embeddedPayloadJson: null,
            },
          ],
        }),
        workflowNodeKeys: [
          { nodeId: "node-7", taskCount: 4, displayName: "Pre-flight checks" },
        ],
      }),
    );
    if (out.kind !== "manifestLibrary") throw new Error("expected manifestLibrary");
    expect(out.tasks[0].stage).toEqual({
      nodeId: "node-7",
      displayLabel: "Pre-flight checks",
      isOnSnapshot: true,
    });
  });

  it("library: revisionIsLatest reflects parent packet's latest published id", () => {
    const detail = libraryRevision({
      revision: { id: "rev-3", revisionNumber: 3, status: "PUBLISHED" },
    });
    const latest = projectLineItemExecutionPreview(
      baseInput({
        scopePacketRevisionId: "rev-3",
        libraryRevision: detail,
        parentPacketLatestPublishedRevisionId: "rev-3",
      }),
    );
    const older = projectLineItemExecutionPreview(
      baseInput({
        scopePacketRevisionId: "rev-3",
        libraryRevision: detail,
        parentPacketLatestPublishedRevisionId: "rev-5",
      }),
    );
    if (latest.kind !== "manifestLibrary" || older.kind !== "manifestLibrary") {
      throw new Error("expected manifestLibrary");
    }
    expect(latest.revisionIsLatest).toBe(true);
    expect(older.revisionIsLatest).toBe(false);
  });

  it("library: sorts tasks by sortOrder then lineKey", () => {
    const out = projectLineItemExecutionPreview(
      baseInput({
        scopePacketRevisionId: "rev-1",
        libraryRevision: libraryRevision({
          packetTaskLines: [
            { lineKey: "z", sortOrder: 2, tierCode: null, targetNodeKey: "n", taskDefinition: null, embeddedPayloadJson: null },
            { lineKey: "b", sortOrder: 1, tierCode: null, targetNodeKey: "n", taskDefinition: null, embeddedPayloadJson: null },
            { lineKey: "a", sortOrder: 1, tierCode: null, targetNodeKey: "n", taskDefinition: null, embeddedPayloadJson: null },
          ],
        }),
      }),
    );
    if (out.kind !== "manifestLibrary") throw new Error("expected manifestLibrary");
    expect(out.tasks.map((t) => t.lineKey)).toEqual(["a", "b", "z"]);
  });

  it("library: gives library pin precedence even when both ids are present (defensive)", () => {
    // Server-side `assertManifestScopePinXor` makes this state unreachable
    // through normal mutations, but the projection is intentionally total.
    const out = projectLineItemExecutionPreview(
      baseInput({
        scopePacketRevisionId: "rev-1",
        quoteLocalPacketId: "qlp-1",
        libraryRevision: libraryRevision({
          packetTaskLines: [
            { lineKey: "a", sortOrder: 1, tierCode: null, targetNodeKey: "n", taskDefinition: null, embeddedPayloadJson: null },
          ],
        }),
        localPacket: localPacket({
          items: [
            { lineKey: "x", sortOrder: 1, tierCode: null, targetNodeKey: "n", taskDefinition: null, embeddedPayloadJson: null },
          ],
        }),
      }),
    );
    expect(out.kind).toBe("manifestLibrary");
  });

  it("local: parses embedded title and embedded requirements", () => {
    const out = projectLineItemExecutionPreview(
      baseInput({
        quoteLocalPacketId: "qlp-1",
        localPacket: localPacket({
          items: [
            {
              lineKey: "a",
              sortOrder: 1,
              tierCode: "STANDARD",
              targetNodeKey: "node-1",
              taskDefinition: null,
              embeddedPayloadJson: {
                title: "  Inline task  ",
                completionRequirementsJson: [
                  { kind: "checklist", label: "Lock out", required: true },
                  { kind: "result", required: true },
                ],
              },
            },
          ],
        }),
      }),
    );
    if (out.kind !== "manifestLocal") throw new Error("expected manifestLocal");
    expect(out.tasks[0]).toMatchObject({
      title: "Inline task",
      sourceKind: "embedded",
      taskDefinitionRef: null,
      tierCode: "STANDARD",
      requirementKinds: ["checklist", "result"],
    });
  });

  it("local: falls back to lineKey when embedded title is missing or blank", () => {
    const out = projectLineItemExecutionPreview(
      baseInput({
        quoteLocalPacketId: "qlp-1",
        localPacket: localPacket({
          items: [
            {
              lineKey: "fallback-key",
              sortOrder: 1,
              tierCode: null,
              targetNodeKey: "node-1",
              taskDefinition: null,
              embeddedPayloadJson: { title: "   " },
            },
          ],
        }),
      }),
    );
    if (out.kind !== "manifestLocal") throw new Error("expected manifestLocal");
    expect(out.tasks[0].title).toBe("fallback-key");
  });

  it("requirements: missing entry in the map projects to empty list, not error", () => {
    const out = projectLineItemExecutionPreview(
      baseInput({
        scopePacketRevisionId: "rev-1",
        libraryRevision: libraryRevision({
          packetTaskLines: [
            {
              lineKey: "a",
              sortOrder: 1,
              tierCode: null,
              targetNodeKey: "n",
              taskDefinition: { id: "td-missing", taskKey: "tk", displayName: "X", status: "PUBLISHED" },
              embeddedPayloadJson: null,
            },
          ],
        }),
        // Empty map → td-missing is absent → empty kinds, no throw.
      }),
    );
    if (out.kind !== "manifestLibrary") throw new Error("expected manifestLibrary");
    expect(out.tasks[0].requirementKinds).toEqual([]);
  });

  it("requirements: malformed embedded JSON projects to empty list, not error", () => {
    const out = projectLineItemExecutionPreview(
      baseInput({
        quoteLocalPacketId: "qlp-1",
        localPacket: localPacket({
          items: [
            {
              lineKey: "a",
              sortOrder: 1,
              tierCode: null,
              targetNodeKey: "n",
              taskDefinition: null,
              embeddedPayloadJson: { completionRequirementsJson: "not-an-array" },
            },
          ],
        }),
      }),
    );
    if (out.kind !== "manifestLocal") throw new Error("expected manifestLocal");
    expect(out.tasks[0].requirementKinds).toEqual([]);
  });

  it("title: prefers TaskDefinition.displayName over embedded payload", () => {
    const out = projectLineItemExecutionPreview(
      baseInput({
        scopePacketRevisionId: "rev-1",
        libraryRevision: libraryRevision({
          packetTaskLines: [
            {
              lineKey: "a",
              sortOrder: 1,
              tierCode: null,
              targetNodeKey: "n",
              taskDefinition: { id: "td-1", taskKey: "tk", displayName: "Library title", status: "PUBLISHED" },
              embeddedPayloadJson: { title: "Embedded title" },
            },
          ],
        }),
      }),
    );
    if (out.kind !== "manifestLibrary") throw new Error("expected manifestLibrary");
    expect(out.tasks[0].title).toBe("Library title");
    expect(out.tasks[0].sourceKind).toBe("taskDefinition");
  });
});

describe("buildExecutionPreviewSummary", () => {
  function row(displayLabel: string) {
    return { stage: { displayLabel } };
  }

  it("returns '0 crew tasks' when the task list is empty", () => {
    expect(buildExecutionPreviewSummary([])).toBe("0 crew tasks");
  });

  it("uses singular 'crew task' for one task", () => {
    expect(buildExecutionPreviewSummary([row("Site Survey")])).toBe(
      "1 crew task — at Site Survey",
    );
  });

  it("renders the example flow verbatim: 4 tasks across three distinct stages", () => {
    expect(
      buildExecutionPreviewSummary([
        row("Site Survey"),
        row("Install"),
        row("Install"),
        row("Commissioning"),
      ]),
    ).toBe("4 crew tasks — at Site Survey → Install → Commissioning");
  });

  it("dedupes repeated stages in first-seen order", () => {
    // The user-spec example: 5 tasks where 'Install' repeats — must collapse to
    // "Site Survey → Install → Closeout" preserving the order they were first seen.
    expect(
      buildExecutionPreviewSummary([
        row("Site Survey"),
        row("Install"),
        row("Install"),
        row("Install"),
        row("Closeout"),
      ]),
    ).toBe("5 crew tasks — at Site Survey → Install → Closeout");
  });

  it("treats interleaved repeats as already-seen and keeps the original order", () => {
    expect(
      buildExecutionPreviewSummary([
        row("A"),
        row("B"),
        row("A"),
        row("C"),
        row("B"),
      ]),
    ).toBe("5 crew tasks — at A → B → C");
  });

  it("falls back to bare task count when every stage label is empty", () => {
    expect(buildExecutionPreviewSummary([row(""), row(""), row("")])).toBe("3 crew tasks");
  });

  it("ignores empty stage labels but still surfaces non-empty ones", () => {
    expect(
      buildExecutionPreviewSummary([row(""), row("Install"), row(""), row("Closeout")]),
    ).toBe("4 crew tasks — at Install → Closeout");
  });
});
