import { describe, expect, it } from "vitest";
import {
  buildCanonicalWorkflowSnapshotJson,
  CANONICAL_WORKFLOW_TEMPLATE_DISPLAY_NAME,
  CANONICAL_WORKFLOW_TEMPLATE_KEY,
  CANONICAL_WORKFLOW_VERSION_NUMBER,
} from "./canonical-workflow-snapshot";
import { CANONICAL_STAGE_KEYS } from "./canonical-execution-stages";
import { validateWorkflowSnapshotForPublish } from "./workflow-version-snapshot";

describe("buildCanonicalWorkflowSnapshotJson", () => {
  it("emits the six canonical stages in canonical order", () => {
    const snap = buildCanonicalWorkflowSnapshotJson();
    expect(snap.nodes.map((n) => n.id)).toEqual(CANONICAL_STAGE_KEYS);
  });

  it("each node has a non-empty displayName and an empty tasks array", () => {
    const snap = buildCanonicalWorkflowSnapshotJson();
    for (const node of snap.nodes) {
      expect(typeof node.displayName).toBe("string");
      expect(node.displayName.length).toBeGreaterThan(0);
      expect(node.tasks).toEqual([]);
    }
  });

  it("passes the publish-snapshot validator (≥1 node, unique non-empty ids)", () => {
    const snap = buildCanonicalWorkflowSnapshotJson();
    expect(validateWorkflowSnapshotForPublish(snap)).toBeNull();
  });

  it("identifiers are stable for ensure-helper lookups", () => {
    expect(CANONICAL_WORKFLOW_TEMPLATE_KEY).toBe("canonical-stages");
    expect(CANONICAL_WORKFLOW_TEMPLATE_DISPLAY_NAME).toBe("Standard Execution");
    expect(CANONICAL_WORKFLOW_VERSION_NUMBER).toBe(1);
  });
});
