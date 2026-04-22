import type { WorkflowVersionStatus } from "@prisma/client";

/** Initial body shown in the draft JSON editor when snapshot is empty or trivial. */
export const DEFAULT_DRAFT_SNAPSHOT_DISPLAY = `{
  "nodes": []
}`;

/** Only DRAFT versions may use the coarse snapshot replace + publish actions in office UI. */
export function workflowVersionAllowsSnapshotJsonEdit(status: WorkflowVersionStatus): boolean {
  return status === "DRAFT";
}

export function stringifySnapshotForEditor(snapshotJson: unknown): string {
  try {
    return JSON.stringify(snapshotJson ?? { nodes: [] }, null, 2);
  } catch {
    return DEFAULT_DRAFT_SNAPSHOT_DISPLAY;
  }
}
