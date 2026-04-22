import { describe, expect, it } from "vitest";
import {
  DEFAULT_DRAFT_SNAPSHOT_DISPLAY,
  stringifySnapshotForEditor,
  workflowVersionAllowsSnapshotJsonEdit,
} from "./process-templates-office";

describe("workflowVersionAllowsSnapshotJsonEdit", () => {
  it("allows only DRAFT", () => {
    expect(workflowVersionAllowsSnapshotJsonEdit("DRAFT")).toBe(true);
    expect(workflowVersionAllowsSnapshotJsonEdit("PUBLISHED")).toBe(false);
    expect(workflowVersionAllowsSnapshotJsonEdit("SUPERSEDED")).toBe(false);
  });
});

describe("stringifySnapshotForEditor", () => {
  it("formats object with indentation", () => {
    const s = stringifySnapshotForEditor({ nodes: [{ id: "a" }] });
    expect(s).toContain('"nodes"');
    expect(s).toContain('"a"');
  });

  it("uses default-ish shape for null snapshot", () => {
    const s = stringifySnapshotForEditor(null);
    expect(s).toContain("nodes");
  });
});

describe("DEFAULT_DRAFT_SNAPSHOT_DISPLAY", () => {
  it("is valid JSON with nodes array", () => {
    expect(JSON.parse(DEFAULT_DRAFT_SNAPSHOT_DISPLAY)).toEqual({ nodes: [] });
  });
});
