/**
 * Pure validation for `WorkflowVersion.snapshotJson` (Epic 23 authoring).
 * Aligns with compose expectations: root object, `nodes` array, stable string `id` per node.
 */

export type WorkflowSnapshotPublishValidationFailure = {
  code: "WORKFLOW_VERSION_SNAPSHOT_INVALID";
  message: string;
  details?: Record<string, unknown>;
};

/**
 * Validates snapshot for **publish**: ≥1 node, each node has non-empty string `id`, ids unique.
 */
export function validateWorkflowSnapshotForPublish(snapshotJson: unknown): WorkflowSnapshotPublishValidationFailure | null {
  if (snapshotJson === null || typeof snapshotJson !== "object" || Array.isArray(snapshotJson)) {
    return {
      code: "WORKFLOW_VERSION_SNAPSHOT_INVALID",
      message: "Workflow snapshot must be a non-null JSON object.",
    };
  }
  const nodes = (snapshotJson as Record<string, unknown>).nodes;
  if (!Array.isArray(nodes)) {
    return {
      code: "WORKFLOW_VERSION_SNAPSHOT_INVALID",
      message: "Workflow snapshot must include a `nodes` array.",
    };
  }
  if (nodes.length < 1) {
    return {
      code: "WORKFLOW_VERSION_SNAPSHOT_INVALID",
      message: "Publish requires at least one node in `snapshotJson.nodes`.",
    };
  }
  const seen = new Set<string>();
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n === null || typeof n !== "object" || Array.isArray(n)) {
      return {
        code: "WORKFLOW_VERSION_SNAPSHOT_INVALID",
        message: `nodes[${i}] must be a JSON object.`,
        details: { index: i },
      };
    }
    const idRaw = (n as Record<string, unknown>).id;
    const id = typeof idRaw === "string" ? idRaw.trim() : "";
    if (id === "") {
      return {
        code: "WORKFLOW_VERSION_SNAPSHOT_INVALID",
        message: `nodes[${i}].id must be a non-empty string.`,
        details: { index: i },
      };
    }
    if (seen.has(id)) {
      return {
        code: "WORKFLOW_VERSION_SNAPSHOT_INVALID",
        message: `Duplicate node id "${id}" in workflow snapshot.`,
        details: { nodeId: id },
      };
    }
    seen.add(id);
  }
  return null;
}

/**
 * Validates snapshot for **draft replace**: root object + `nodes` is an array (may be empty).
 */
export function validateWorkflowSnapshotForDraftReplace(snapshotJson: unknown): WorkflowSnapshotPublishValidationFailure | null {
  if (snapshotJson === null || typeof snapshotJson !== "object" || Array.isArray(snapshotJson)) {
    return {
      code: "WORKFLOW_VERSION_SNAPSHOT_INVALID",
      message: "Workflow snapshot must be a non-null JSON object.",
    };
  }
  const nodes = (snapshotJson as Record<string, unknown>).nodes;
  if (!Array.isArray(nodes)) {
    return {
      code: "WORKFLOW_VERSION_SNAPSHOT_INVALID",
      message: "Workflow snapshot must include a `nodes` array.",
    };
  }
  return null;
}
