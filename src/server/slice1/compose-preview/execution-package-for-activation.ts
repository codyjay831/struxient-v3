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
  completionRequirementsJson?: any;
  conditionalRulesJson?: any;
  instructions?: string | null;
};

function isSkeletonPackageSlot(r: Record<string, unknown>): boolean {
  if (r.source === "WORKFLOW") {
    return true;
  }
  const sk = r.skeletonTaskId;
  return typeof sk === "string" && sk !== "";
}

/** Optional extension on `executionPackageSnapshot.v0` — authored at send/freeze time (Epic 47). */
export type FrozenPaymentGateIntentV0 = {
  schemaVersion: "paymentGateIntent.v0";
  title: string;
  /** Each id must match a manifest slot `packageTaskId` in the same snapshot (non-skeleton slots only). */
  targetPackageTaskIds: string[];
};

export type ParseExecutionPackageResult =
  | {
      ok: true;
      pinnedWorkflowVersionId: string;
      slots: ActivationPackageSlot[];
      skippedSkeletonSlotCount: number;
      paymentGateIntent: FrozenPaymentGateIntentV0 | null;
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

    const completionRequirementsJson = r.completionRequirementsJson;
    const conditionalRulesJson = r.conditionalRulesJson;
    const instructions = typeof r.instructions === "string" ? r.instructions : null;

    if (packageTaskId == null || nodeId == null) {
      return { ok: false, code: "INVALID_PACKAGE", message: `slots[${i}] missing packageTaskId or nodeId.` };
    }

    slots.push({ packageTaskId, nodeId, lineItemId, planTaskIds, displayTitle, completionRequirementsJson, conditionalRulesJson, instructions });
  }

  let paymentGateIntent: FrozenPaymentGateIntentV0 | null = null;
  const pgi = o.paymentGateIntent;
  if (pgi != null) {
    if (typeof pgi !== "object" || Array.isArray(pgi)) {
      return { ok: false, code: "INVALID_PAYMENT_GATE_INTENT", message: "paymentGateIntent must be an object." };
    }
    const g = pgi as Record<string, unknown>;
    if (g.schemaVersion !== "paymentGateIntent.v0") {
      return {
        ok: false,
        code: "UNSUPPORTED_PAYMENT_GATE_INTENT",
        message: `Expected paymentGateIntent.v0, got ${String(g.schemaVersion)}.`,
      };
    }
    const title = typeof g.title === "string" ? g.title.trim() : "";
    if (title.length === 0) {
      return { ok: false, code: "INVALID_PAYMENT_GATE_INTENT", message: "paymentGateIntent.title is required." };
    }
    const rawTargets = g.targetPackageTaskIds;
    if (!Array.isArray(rawTargets) || rawTargets.length === 0) {
      return {
        ok: false,
        code: "INVALID_PAYMENT_GATE_INTENT",
        message: "paymentGateIntent.targetPackageTaskIds must be a non-empty string array.",
      };
    }
    const targetPackageTaskIds = [...new Set(rawTargets.filter((x): x is string => typeof x === "string" && x !== ""))];
    if (targetPackageTaskIds.length === 0) {
      return {
        ok: false,
        code: "INVALID_PAYMENT_GATE_INTENT",
        message: "paymentGateIntent.targetPackageTaskIds must contain at least one non-empty packageTaskId.",
      };
    }
    const slotIds = new Set(slots.map((s) => s.packageTaskId));
    const unknown = targetPackageTaskIds.filter((id) => !slotIds.has(id));
    if (unknown.length > 0) {
      return {
        ok: false,
        code: "INVALID_PAYMENT_GATE_INTENT",
        message: `paymentGateIntent references unknown packageTaskId(s): ${unknown.join(", ")}.`,
      };
    }
    paymentGateIntent = { schemaVersion: "paymentGateIntent.v0", title, targetPackageTaskIds };
  }

  return { ok: true, pinnedWorkflowVersionId: pinned, slots, skippedSkeletonSlotCount, paymentGateIntent };
}
