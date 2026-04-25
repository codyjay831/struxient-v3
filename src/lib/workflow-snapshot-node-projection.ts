/**
 * Pure projection of WorkflowVersion.snapshotJson → minimal node-key data
 * used by the QuoteLocalPacketItem `targetNodeKey` picker.
 *
 * Returns ONLY node ids (in snapshot array order, deduped), a derived
 * `taskCount` for disambiguation, and an optional `displayName` (when the
 * snapshot node carries a human-friendly label under `displayName`, `label`,
 * or `name`). Never returns task contents or any other snapshot field —
 * the workflow-version endpoint is intentionally not a snapshot inspection
 * API (see src/app/api/workflow-versions/[workflowVersionId]/route.ts).
 *
 * The optional `displayName` is purely a presentation hint for the
 * `TargetNodePicker`'s "Stage" variant; it does not change persisted
 * `targetNodeKey` strings or any compose binding.
 *
 * Tolerant: returns [] for malformed snapshots so the picker degrades to an
 * empty list instead of throwing in the UI.
 *
 * Snapshot v0 shape: { nodes: [{ id: string, displayName?: string, label?: string,
 *   name?: string, tasks?: [{ id, title? }] }] }.
 * See docs/schema-slice-1/07-snapshot-shape-v0.md.
 */

export type WorkflowNodeKeyProjection = {
  nodeId: string;
  taskCount: number;
  /**
   * Optional human-readable label sourced from the snapshot node's
   * `displayName` / `label` / `name` (in that priority order). `null` when
   * none of those fields is a non-empty string. Authoring UI should fall
   * back to a humanized form of `nodeId` when this is null.
   */
  displayName: string | null;
};

function pickDisplayName(node: Record<string, unknown>): string | null {
  for (const key of ["displayName", "label", "name"] as const) {
    const candidate = node[key];
    if (typeof candidate === "string") {
      const trimmed = candidate.trim();
      if (trimmed !== "") return trimmed;
    }
  }
  return null;
}

export function projectWorkflowNodeKeys(snapshotJson: unknown): WorkflowNodeKeyProjection[] {
  if (snapshotJson === null || typeof snapshotJson !== "object" || Array.isArray(snapshotJson)) {
    return [];
  }
  const nodes = (snapshotJson as Record<string, unknown>).nodes;
  if (!Array.isArray(nodes)) {
    return [];
  }
  const seen = new Set<string>();
  const out: WorkflowNodeKeyProjection[] = [];
  for (const n of nodes) {
    if (n === null || typeof n !== "object" || Array.isArray(n)) {
      continue;
    }
    const node = n as Record<string, unknown>;
    const nodeId = typeof node.id === "string" ? node.id : null;
    if (nodeId == null || nodeId === "") continue;
    if (seen.has(nodeId)) continue;
    seen.add(nodeId);
    const tasks = node.tasks;
    const taskCount = Array.isArray(tasks) ? tasks.length : 0;
    out.push({ nodeId, taskCount, displayName: pickDisplayName(node) });
  }
  return out;
}
