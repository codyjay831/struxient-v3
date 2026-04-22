import { describe, expect, it } from "vitest";
import { validateWorkflowSnapshotForDraftReplace, validateWorkflowSnapshotForPublish } from "./workflow-version-snapshot";

describe("validateWorkflowSnapshotForPublish", () => {
  it("accepts minimal valid snapshot", () => {
    expect(
      validateWorkflowSnapshotForPublish({
        nodes: [{ id: "roof" }, { id: "attic" }],
      }),
    ).toBeNull();
  });

  it("rejects empty nodes", () => {
    expect(validateWorkflowSnapshotForPublish({ nodes: [] })?.message).toMatch(/at least one node/);
  });

  it("rejects duplicate ids", () => {
    expect(
      validateWorkflowSnapshotForPublish({
        nodes: [{ id: "a" }, { id: "a" }],
      })?.message,
    ).toMatch(/Duplicate node id/);
  });

  it("rejects missing id", () => {
    expect(validateWorkflowSnapshotForPublish({ nodes: [{}] })?.message).toMatch(/non-empty string/);
  });
});

describe("validateWorkflowSnapshotForDraftReplace", () => {
  it("allows empty nodes array", () => {
    expect(validateWorkflowSnapshotForDraftReplace({ nodes: [] })).toBeNull();
  });

  it("rejects non-object", () => {
    expect(validateWorkflowSnapshotForDraftReplace(null)).not.toBeNull();
  });
});
