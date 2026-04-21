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
      { nodeId: "node-roof", taskCount: 2 },
      { nodeId: "node-attic", taskCount: 1 },
      { nodeId: "node-cleanup", taskCount: 0 },
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
      { nodeId: "n1", taskCount: 0 },
      { nodeId: "n2", taskCount: 0 },
      { nodeId: "n3", taskCount: 0 },
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
    ).toEqual([{ nodeId: "ok", taskCount: 0 }]);
  });

  it("ignores non-object nodes", () => {
    expect(
      projectWorkflowNodeKeys({
        nodes: ["string", 1, null, [], { id: "ok" }],
      }),
    ).toEqual([{ nodeId: "ok", taskCount: 0 }]);
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
      { nodeId: "z", taskCount: 0 },
      { nodeId: "a", taskCount: 0 },
      { nodeId: "m", taskCount: 0 },
    ]);
  });

  it("does not include label / type / other unknown fields even when present", () => {
    const result = projectWorkflowNodeKeys({
      nodes: [{ id: "n1", label: "Roof", type: "PHYSICAL", tasks: [] }],
    });
    expect(result).toEqual([{ nodeId: "n1", taskCount: 0 }]);
    // and the keys are exactly nodeId+taskCount (no leak)
    expect(Object.keys(result[0]).sort()).toEqual(["nodeId", "taskCount"]);
  });
});
