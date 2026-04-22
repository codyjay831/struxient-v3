import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import type { ComposePackageSlotDto, ComposePlanRowDto, ComposeValidationItem } from "./compose-engine";
import type { FrozenPaymentGateIntentV0 } from "./execution-package-for-activation";

export function canonicalStringify(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "boolean" || typeof value === "number") {
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((x) => canonicalStringify(x)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalStringify(obj[k])}`).join(",")}}`;
}

export function sha256HexUtf8(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

function planRowToFrozenJson(r: ComposePlanRowDto): Record<string, unknown> {
  const base: Record<string, unknown> = {
    planTaskId: r.planTaskId,
    lineItemId: r.lineItemId,
    scopeSource: r.scopeSource,
    quantityIndex: r.quantityIndex,
    targetNodeKey: r.targetNodeKey,
    title: r.title,
    taskKind: r.taskKind,
    sortKey: r.sortKey,
  };
  if (r.tierCode != null && r.tierCode !== "") {
    base.tierCode = r.tierCode;
  }
  if (r.scopeSource === "LIBRARY_PACKET") {
    base.scopePacketRevisionId = r.scopePacketRevisionId;
    base.packetLineKey = r.packetLineKey;
  } else if (r.scopeSource === "QUOTE_LOCAL_PACKET") {
    base.quoteLocalPacketId = r.quoteLocalPacketId;
    base.localLineKey = r.localLineKey;
  }
  return base;
}

function packageSlotToFrozenJson(s: ComposePackageSlotDto): Record<string, unknown> {
  const base: Record<string, unknown> = {
    packageTaskId: s.packageTaskId,
    nodeId: s.nodeId,
    source: s.source,
    planTaskIds: s.planTaskIds,
    skeletonTaskId: s.skeletonTaskId,
    lineItemIds: [s.lineItemId],
    displayTitle: s.displayTitle,
  };
  if (s.completionRequirementsJson) {
    base.completionRequirementsJson = s.completionRequirementsJson;
  }
  if (s.conditionalRulesJson) {
    base.conditionalRulesJson = s.conditionalRulesJson;
  }
  if (s.instructions != null && s.instructions !== "") {
    base.instructions = s.instructions;
  }
  return base;
}

function validationToDiagnostic(v: ComposeValidationItem): Record<string, unknown> {
  const o: Record<string, unknown> = {
    code: v.code,
    message: v.message,
  };
  if (v.lineItemId != null) o.lineItemId = v.lineItemId;
  if (v.planTaskId != null) o.planTaskId = v.planTaskId;
  if (v.details != null) o.details = v.details;
  return o;
}

export function buildGeneratedPlanSnapshotV0(params: {
  quoteVersionId: string;
  pinnedWorkflowVersionId: string;
  generatedAtIso: string;
  planRows: ComposePlanRowDto[];
}): Prisma.InputJsonValue {
  return {
    schemaVersion: "generatedPlanSnapshot.v0",
    quoteVersionId: params.quoteVersionId,
    pinnedWorkflowVersionId: params.pinnedWorkflowVersionId,
    generatedAt: params.generatedAtIso,
    rows: params.planRows.map(planRowToFrozenJson),
  } as Prisma.InputJsonValue;
}

export function buildExecutionPackageSnapshotV0(params: {
  quoteVersionId: string;
  pinnedWorkflowVersionId: string;
  composedAtIso: string;
  packageSlots: ComposePackageSlotDto[];
  diagnostics: { errors: ComposeValidationItem[]; warnings: ComposeValidationItem[] };
  /** Optional; validated at activation against manifest `packageTaskId`s (Epic 47). */
  paymentGateIntent?: FrozenPaymentGateIntentV0 | null;
}): Prisma.InputJsonValue {
  const base: Record<string, unknown> = {
    schemaVersion: "executionPackageSnapshot.v0",
    quoteVersionId: params.quoteVersionId,
    pinnedWorkflowVersionId: params.pinnedWorkflowVersionId,
    composedAt: params.composedAtIso,
    slots: params.packageSlots.map(packageSlotToFrozenJson),
    diagnostics: {
      errors: params.diagnostics.errors.map(validationToDiagnostic),
      warnings: params.diagnostics.warnings.map(validationToDiagnostic),
    },
  };
  if (params.paymentGateIntent != null) {
    base.paymentGateIntent = params.paymentGateIntent;
  }
  return base as Prisma.InputJsonValue;
}
