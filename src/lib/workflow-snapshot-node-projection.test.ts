import { describe, expect, it } from "vitest";
import { projectWorkflowNodeKeys } from "./workflow-snapshot-node-projection";

describe("projectWorkflowNodeKeys", () => {
  it("projects ordered, deduped node ids with task counts from a v0 snapshot", () => {
    const snapshot = {
      nodes: [
        { id: "node-roof", tasks: [{ id: "sk-a" }, { id: "sk-b" }] },
        { id: "node-attic", tasks: [{ id: "sk-c" }] },
        { id: "node-roof", tasks: [{ id: "dup" }] },
        { id: "node-cleanup" },
      ],
    };
    expect(projectWorkflowNodeKeys(snapshot)).toEqual([
      { nodeId: "node-roof", taskCount: 2, displayName: null },
      { nodeId: "node-attic", taskCount: 1, displayName: null },
      { nodeId: "node-cleanup", taskCount: 0, displayName: null },
    ]);
  });

  it("returns 0 taskCount when tasks is missing or not an array", () => {
    expect(
      projectWorkflowNodeKeys({
        nodes: [
          { id: "n1" },
          { id: "n2", tasks: null },
          { id: "n3", tasks: "nope" },
        ],
      }),
    ).toEqual([
      { nodeId: "n1", taskCount: 0, displayName: null },
      { nodeId: "n2", taskCount: 0, displayName: null },
      { nodeId: "n3", taskCount: 0, displayName: null },
    ]);
  });

  it("ignores nodes without a valid string id", () => {
    expect(
      projectWorkflowNodeKeys({
        nodes: [
          { id: "" },
          { id: 42 },
          { id: null },
          { tasks: [] },
          { id: "ok" },
        ],
      }),
    ).toEqual([{ nodeId: "ok", taskCount: 0, displayName: null }]);
  });

  it("ignores non-object nodes", () => {
    expect(
      projectWorkflowNodeKeys({
        nodes: ["string", 1, null, [], { id: "ok" }],
      }),
    ).toEqual([{ nodeId: "ok", taskCount: 0, displayName: null }]);
  });

  it("returns [] for null / non-object / array snapshot", () => {
    expect(projectWorkflowNodeKeys(null)).toEqual([]);
    expect(projectWorkflowNodeKeys(undefined)).toEqual([]);
    expect(projectWorkflowNodeKeys("string")).toEqual([]);
    expect(projectWorkflowNodeKeys(7)).toEqual([]);
    expect(projectWorkflowNodeKeys([])).toEqual([]);
  });

  it("returns [] when nodes is missing or not an array", () => {
    expect(projectWorkflowNodeKeys({})).toEqual([]);
    expect(projectWorkflowNodeKeys({ nodes: null })).toEqual([]);
    expect(projectWorkflowNodeKeys({ nodes: "x" })).toEqual([]);
    expect(projectWorkflowNodeKeys({ nodes: { id: "n1" } })).toEqual([]);
  });

  it("preserves snapshot array order", () => {
    expect(
      projectWorkflowNodeKeys({
        nodes: [{ id: "z" }, { id: "a" }, { id: "m" }],
      }),
    ).toEqual([
      { nodeId: "z", taskCount: 0, displayName: null },
      { nodeId: "a", taskCount: 0, displayName: null },
      { nodeId: "m", taskCount: 0, displayName: null },
    ]);
  });

  it("extracts displayName from displayName / label / name in priority order", () => {
    expect(
      projectWorkflowNodeKeys({
        nodes: [
          { id: "n1", displayName: "Tear-off", label: "ignored", name: "ignored" },
          { id: "n2", label: "Inspect attic", name: "ignored" },
          { id: "n3", name: "Cleanup site" },
          { id: "n4" },
        ],
      }),
    ).toEqual([
      { nodeId: "n1", taskCount: 0, displayName: "Tear-off" },
      { nodeId: "n2", taskCount: 0, displayName: "Inspect attic" },
      { nodeId: "n3", taskCount: 0, displayName: "Cleanup site" },
      { nodeId: "n4", taskCount: 0, displayName: null },
    ]);
  });

  it("ignores non-string and empty/whitespace displayName candidates", () => {
    expect(
      projectWorkflowNodeKeys({
        nodes: [
          { id: "n1", displayName: 42, label: "Use this" },
          { id: "n2", displayName: "", label: "   ", name: "Fallback" },
          { id: "n3", displayName: "  Trimmed  " },
        ],
      }),
    ).toEqual([
      { nodeId: "n1", taskCount: 0, displayName: "Use this" },
      { nodeId: "n2", taskCount: 0, displayName: "Fallback" },
      { nodeId: "n3", taskCount: 0, displayName: "Trimmed" },
    ]);
  });

  it("does not leak unknown snapshot fields beyond nodeId / taskCount / displayName", () => {
    const result = projectWorkflowNodeKeys({
      nodes: [{ id: "n1", label: "Roof", type: "PHYSICAL", color: "red", tasks: [] }],
    });
    expect(result).toEqual([{ nodeId: "n1", taskCount: 0, displayName: "Roof" }]);
    expect(Object.keys(result[0]).sort()).toEqual(["displayName", "nodeId", "taskCount"]);
  });
});
