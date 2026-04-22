/**
 * Best-effort parse of skeleton tasks from WorkflowVersion.snapshotJson.
 * Supports nodes[].tasks[] with { id, title? }; empty when only node ids exist (seed shape).
 */

export type WorkflowSkeletonTaskRow = {
  nodeId: string;
  skeletonTaskId: string;
  displayTitle: string;
};

/** Node ids in snapshot array order (deduped); drives work-item ordering. */
export function parseWorkflowNodeIdsInOrder(snapshotJson: unknown): string[] {
  if (snapshotJson === null || typeof snapshotJson !== "object" || Array.isArray(snapshotJson)) {
    return [];
  }
  const nodes = (snapshotJson as Record<string, unknown>).nodes;
  if (!Array.isArray(nodes)) {
    return [];
  }
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const n of nodes) {
    if (n === null || typeof n !== "object" || Array.isArray(n)) {
      continue;
    }
    const nodeId = typeof (n as Record<string, unknown>).id === "string" ? (n as { id: string }).id : null;
    if (nodeId != null && nodeId !== "" && !seen.has(nodeId)) {
      seen.add(nodeId);
      ids.push(nodeId);
    }
  }
  return ids;
}

/** Frozen completion contract for a skeleton task id on `WorkflowVersion.snapshotJson` (nodes[].tasks[]). */
export function lookupSkeletonTaskCompletionContractInSnapshot(
  snapshotJson: unknown,
  skeletonTaskId: string,
): { completionRequirementsJson: unknown[]; conditionalRulesJson: unknown[] } {
  const empty: unknown[] = [];
  if (snapshotJson === null || typeof snapshotJson !== "object" || Array.isArray(snapshotJson)) {
    return { completionRequirementsJson: empty, conditionalRulesJson: empty };
  }
  const nodes = (snapshotJson as Record<string, unknown>).nodes;
  if (!Array.isArray(nodes)) {
    return { completionRequirementsJson: empty, conditionalRulesJson: empty };
  }
  for (const n of nodes) {
    if (n === null || typeof n !== "object" || Array.isArray(n)) {
      continue;
    }
    const node = n as Record<string, unknown>;
    const tasks = node.tasks;
    if (!Array.isArray(tasks)) {
      continue;
    }
    for (const t of tasks) {
      if (t === null || typeof t !== "object" || Array.isArray(t)) {
        continue;
      }
      const tr = t as Record<string, unknown>;
      const tid = typeof tr.id === "string" && tr.id !== "" ? tr.id : null;
      if (tid !== skeletonTaskId) {
        continue;
      }
      const cr = tr.completionRequirementsJson;
      const cond = tr.conditionalRulesJson;
      return {
        completionRequirementsJson: Array.isArray(cr) ? cr : empty,
        conditionalRulesJson: Array.isArray(cond) ? cond : empty,
      };
    }
  }
  return { completionRequirementsJson: empty, conditionalRulesJson: empty };
}

export function parseSkeletonTasksFromWorkflowSnapshot(snapshotJson: unknown): WorkflowSkeletonTaskRow[] {
  if (snapshotJson === null || typeof snapshotJson !== "object" || Array.isArray(snapshotJson)) {
    return [];
  }
  const o = snapshotJson as Record<string, unknown>;
  const nodes = o.nodes;
  if (!Array.isArray(nodes)) {
    return [];
  }
  const out: WorkflowSkeletonTaskRow[] = [];
  for (const n of nodes) {
    if (n === null || typeof n !== "object" || Array.isArray(n)) {
      continue;
    }
    const node = n as Record<string, unknown>;
    const nodeId = typeof node.id === "string" && node.id !== "" ? node.id : null;
    if (nodeId == null) {
      continue;
    }
    const tasks = node.tasks;
    if (!Array.isArray(tasks)) {
      continue;
    }
    for (const t of tasks) {
      if (t === null || typeof t !== "object" || Array.isArray(t)) {
        continue;
      }
      const tr = t as Record<string, unknown>;
      const tid = typeof tr.id === "string" && tr.id !== "" ? tr.id : null;
      if (tid == null) {
        continue;
      }
      const title = typeof tr.title === "string" && tr.title !== "" ? tr.title : tid;
      out.push({ nodeId, skeletonTaskId: tid, displayTitle: title });
    }
  }
  return out;
}
