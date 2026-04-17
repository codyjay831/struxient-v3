/**
 * Parse frozen executionPackageSnapshot.v0 for activation (manifest slots → RuntimeTask rows).
 * Skips workflow skeleton slots (`source: WORKFLOW` or non-null `skeletonTaskId`) per canon/03.
 */

export type ActivationPackageSlot = {
  packageTaskId: string;
  nodeId: string;
  lineItemId: string;
  planTaskIds: string[];
  displayTitle: string;
};

function isSkeletonPackageSlot(r: Record<string, unknown>): boolean {
  if (r.source === "WORKFLOW") {
    return true;
  }
  const sk = r.skeletonTaskId;
  return typeof sk === "string" && sk !== "";
}

export type ParseExecutionPackageResult =
  | {
      ok: true;
      pinnedWorkflowVersionId: string;
      slots: ActivationPackageSlot[];
      skippedSkeletonSlotCount: number;
    }
  | { ok: false; code: string; message: string };

export function parseExecutionPackageSnapshotV0ForActivation(json: unknown): ParseExecutionPackageResult {
  if (json === null || typeof json !== "object" || Array.isArray(json)) {
    return { ok: false, code: "INVALID_PACKAGE", message: "Execution package must be an object." };
  }
  const o = json as Record<string, unknown>;
  if (o.schemaVersion !== "executionPackageSnapshot.v0") {
    return {
      ok: false,
      code: "UNSUPPORTED_PACKAGE_VERSION",
      message: `Expected executionPackageSnapshot.v0, got ${String(o.schemaVersion)}.`,
    };
  }
  const pinned =
    typeof o.pinnedWorkflowVersionId === "string" && o.pinnedWorkflowVersionId !== ""
      ? o.pinnedWorkflowVersionId
      : null;
  if (pinned == null) {
    return { ok: false, code: "INVALID_PACKAGE", message: "executionPackageSnapshot.pinnedWorkflowVersionId missing." };
  }

  const slotsRaw = o.slots;
  if (!Array.isArray(slotsRaw)) {
    return { ok: false, code: "INVALID_PACKAGE", message: "executionPackageSnapshot.slots must be an array." };
  }

  const slots: ActivationPackageSlot[] = [];
  let skippedSkeletonSlotCount = 0;

  for (let i = 0; i < slotsRaw.length; i++) {
    const s = slotsRaw[i];
    if (s === null || typeof s !== "object" || Array.isArray(s)) {
      return { ok: false, code: "INVALID_PACKAGE", message: `slots[${i}] must be an object.` };
    }
    const r = s as Record<string, unknown>;

    if (isSkeletonPackageSlot(r)) {
      skippedSkeletonSlotCount += 1;
      continue;
    }

    const packageTaskId = typeof r.packageTaskId === "string" && r.packageTaskId !== "" ? r.packageTaskId : null;
    const nodeId = typeof r.nodeId === "string" && r.nodeId !== "" ? r.nodeId : null;
    const displayTitle = typeof r.displayTitle === "string" ? r.displayTitle : "";
    const planTaskIdsRaw = r.planTaskIds;
    if (!Array.isArray(planTaskIdsRaw)) {
      return { ok: false, code: "INVALID_PACKAGE", message: `slots[${i}].planTaskIds must be an array.` };
    }
    const planTaskIds = planTaskIdsRaw.filter((x): x is string => typeof x === "string" && x !== "");
    if (planTaskIds.length === 0) {
      return { ok: false, code: "INVALID_PACKAGE", message: `slots[${i}].planTaskIds must be non-empty.` };
    }

    const lineItemIds = r.lineItemIds;
    let lineItemId: string | null = null;
    if (Array.isArray(lineItemIds) && lineItemIds.length > 0 && typeof lineItemIds[0] === "string") {
      lineItemId = lineItemIds[0];
    }
    if (lineItemId == null || lineItemId === "") {
      const fallback = typeof r.lineItemId === "string" ? r.lineItemId : null;
      lineItemId = fallback && fallback !== "" ? fallback : null;
    }
    if (lineItemId == null) {
      return { ok: false, code: "INVALID_PACKAGE", message: `slots[${i}] missing lineItemIds[0] or lineItemId.` };
    }

    if (packageTaskId == null || nodeId == null) {
      return { ok: false, code: "INVALID_PACKAGE", message: `slots[${i}] missing packageTaskId or nodeId.` };
    }

    slots.push({ packageTaskId, nodeId, lineItemId, planTaskIds, displayTitle });
  }

  return { ok: true, pinnedWorkflowVersionId: pinned, slots, skippedSkeletonSlotCount };
}
