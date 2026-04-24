import { describe, expect, it } from "vitest";
import {
  listPublishBlockingWorkflowSnapshotWarnings,
  validateWorkflowSnapshotForDraftReplace,
  validateWorkflowSnapshotForPublish,
} from "./workflow-version-snapshot";

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

describe("listPublishBlockingWorkflowSnapshotWarnings", () => {
  it("warns when publish would require nodes but array is empty", () => {
    const w = listPublishBlockingWorkflowSnapshotWarnings({ nodes: [] });
    expect(w).toHaveLength(1);
    expect(w[0]).toMatch(/at least one node/);
  });

  it("is empty when publish would succeed", () => {
    expect(listPublishBlockingWorkflowSnapshotWarnings({ nodes: [{ id: "a" }] })).toEqual([]);
  });

  it("lists multiple node issues without diverging from publish first failure", () => {
    const snapshot = { nodes: [{ id: "x" }, {}, { id: "x" }] };
    const w = listPublishBlockingWorkflowSnapshotWarnings(snapshot);
    expect(w.length).toBeGreaterThanOrEqual(2);
    expect(validateWorkflowSnapshotForPublish(snapshot)?.message).toBe(w[0]);
  });

  it("matches publish root and nodes-array messages", () => {
    expect(listPublishBlockingWorkflowSnapshotWarnings(null)[0]).toBe(
      validateWorkflowSnapshotForPublish(null)?.message,
    );
    expect(listPublishBlockingWorkflowSnapshotWarnings({ nodes: "nope" })[0]).toBe(
      validateWorkflowSnapshotForPublish({ nodes: "nope" } as unknown)?.message,
    );
  });
});

describe("validateWorkflowSnapshotForDraftReplace", () => {
  it("allows empty nodes array", () => {
    expect(validateWorkflowSnapshotForDraftReplace({ nodes: [] })).toBeNull();
  });

  it("rejects non-object", () => {
    expect(validateWorkflowSnapshotForDraftReplace(null)).not.toBeNull();
  });

  it("when nodes non-empty, rejects same shapes publish rejects", () => {
    expect(validateWorkflowSnapshotForDraftReplace({ nodes: [{}] })?.message).toMatch(/non-empty string/);
    expect(validateWorkflowSnapshotForDraftReplace({ nodes: [{ id: "" }] })?.message).toMatch(/non-empty string/);
    expect(validateWorkflowSnapshotForDraftReplace({ nodes: [{ id: "a" }, { id: "a" }] })?.message).toMatch(
      /Duplicate node id/,
    );
    expect(validateWorkflowSnapshotForDraftReplace({ nodes: [null] })?.message).toMatch(/JSON object/);
  });

  it("when nodes non-empty, accepts minimal publish-parity snapshot", () => {
    expect(validateWorkflowSnapshotForDraftReplace({ nodes: [{ id: "a" }, { id: "b" }] })).toBeNull();
  });
});
