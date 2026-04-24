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
 * Publish-parity checks for **non-empty** `nodes` arrays only.
 * Caller must ensure `nodes` is already a proven `Array` before calling.
 * Collects every issue (same messages/details as legacy single-pass) for UI hints;
 * {@link validateWorkflowSnapshotForPublish} still surfaces only the first failure.
 */
function collectNonEmptyWorkflowSnapshotNodesArrayIssues(
  nodes: unknown[],
): WorkflowSnapshotPublishValidationFailure[] {
  const out: WorkflowSnapshotPublishValidationFailure[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n === null || typeof n !== "object" || Array.isArray(n)) {
      out.push({
        code: "WORKFLOW_VERSION_SNAPSHOT_INVALID",
        message: `nodes[${i}] must be a JSON object.`,
        details: { index: i },
      });
      continue;
    }
    const idRaw = (n as Record<string, unknown>).id;
    const id = typeof idRaw === "string" ? idRaw.trim() : "";
    if (id === "") {
      out.push({
        code: "WORKFLOW_VERSION_SNAPSHOT_INVALID",
        message: `nodes[${i}].id must be a non-empty string.`,
        details: { index: i },
      });
      continue;
    }
    if (seen.has(id)) {
      out.push({
        code: "WORKFLOW_VERSION_SNAPSHOT_INVALID",
        message: `Duplicate node id "${id}" in workflow snapshot.`,
        details: { nodeId: id },
      });
    } else {
      seen.add(id);
    }
  }
  return out;
}

function lintNonEmptyWorkflowSnapshotNodesArray(
  nodes: unknown[],
): WorkflowSnapshotPublishValidationFailure | null {
  const issues = collectNonEmptyWorkflowSnapshotNodesArrayIssues(nodes);
  return issues.length > 0 ? issues[0]! : null;
}

/**
 * Publish-blocking issues as plain messages, aligned with
 * {@link validateWorkflowSnapshotForPublish} (same root/`nodes` rules and node lint).
 * Intended for non-blocking UI hints; server publish still uses `validateWorkflowSnapshotForPublish`.
 */
export function listPublishBlockingWorkflowSnapshotWarnings(snapshotJson: unknown): string[] {
  if (snapshotJson === null || typeof snapshotJson !== "object" || Array.isArray(snapshotJson)) {
    return ["Workflow snapshot must be a non-null JSON object."];
  }
  const nodes = (snapshotJson as Record<string, unknown>).nodes;
  if (!Array.isArray(nodes)) {
    return ["Workflow snapshot must include a `nodes` array."];
  }
  const messages: string[] = [];
  if (nodes.length < 1) {
    messages.push("Publish requires at least one node in `snapshotJson.nodes`.");
  }
  if (nodes.length > 0) {
    messages.push(...collectNonEmptyWorkflowSnapshotNodesArrayIssues(nodes).map((f) => f.message));
  }
  return messages;
}

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
  return lintNonEmptyWorkflowSnapshotNodesArray(nodes);
}

/**
 * Validates snapshot for **draft replace**: root object + `nodes` is an array (may be empty).
 * When `nodes.length > 0`, the same node-id rules as **publish** apply (non-object entries,
 * missing/empty `id`, duplicate ids are rejected). Empty `nodes` remains valid WIP.
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
  if (nodes.length === 0) {
    return null;
  }
  return lintNonEmptyWorkflowSnapshotNodesArray(nodes);
}
