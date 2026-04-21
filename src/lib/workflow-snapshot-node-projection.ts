/**
 * Pure projection of WorkflowVersion.snapshotJson → minimal node-key data
 * used by the QuoteLocalPacketItem `targetNodeKey` picker.
 *
 * Returns ONLY node ids (in snapshot array order, deduped) plus a derived
 * `taskCount` for disambiguation. Never returns task contents, labels, or
 * any other snapshot field — the workflow-version endpoint is intentionally
 * not a snapshot inspection API (see
 * src/app/api/workflow-versions/[workflowVersionId]/route.ts).
 *
 * Tolerant: returns [] for malformed snapshots so the picker degrades to an
 * empty list instead of throwing in the UI.
 *
 * Snapshot v0 shape: { nodes: [{ id: string, tasks?: [{ id, title? }] }] }.
 * See docs/schema-slice-1/07-snapshot-shape-v0.md.
 */

export type WorkflowNodeKeyProjection = {
  nodeId: string;
  taskCount: number;
};

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
    out.push({ nodeId, taskCount });
  }
  return out;
}
