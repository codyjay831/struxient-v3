import { createHash } from "node:crypto";

/**
 * Deterministic planTaskId per planning/01 §6 — hash of stable structural tuple (not display title).
 */
export function computePlanTaskIdLibrary(params: {
  quoteVersionId: string;
  lineItemId: string;
  scopePacketRevisionId: string;
  packetLineKey: string;
  quantityIndex: number;
  targetNodeKey: string;
}): string {
  const tuple = {
    v: 1,
    scopeSource: "LIBRARY_PACKET",
    quoteVersionId: params.quoteVersionId,
    lineItemId: params.lineItemId,
    scopePacketRevisionId: params.scopePacketRevisionId,
    packetLineKey: params.packetLineKey,
    quantityIndex: params.quantityIndex,
    targetNodeKey: params.targetNodeKey,
  };
  return `pt_${hash20(tuple)}`;
}

/**
 * Packet-free commercial line (`executionMode` SOLD_SCOPE). Slice-1 placeholder until line-level placement exists.
 * @see docs/implementation/reports/2026-04-11-sold-scope-compose-expansion.md
 */
export function computePlanTaskIdCommercialSold(params: {
  quoteVersionId: string;
  lineItemId: string;
  quantityIndex: number;
  targetNodeKey: string;
}): string {
  const tuple = {
    v: 1,
    scopeSource: "COMMERCIAL_SOLD",
    quoteVersionId: params.quoteVersionId,
    lineItemId: params.lineItemId,
    quantityIndex: params.quantityIndex,
    targetNodeKey: params.targetNodeKey,
  };
  return `pt_${hash20(tuple)}`;
}

export function computePlanTaskIdLocal(params: {
  quoteVersionId: string;
  lineItemId: string;
  quoteLocalPacketId: string;
  localLineKey: string;
  quantityIndex: number;
  targetNodeKey: string;
}): string {
  const tuple = {
    v: 1,
    scopeSource: "QUOTE_LOCAL_PACKET",
    quoteVersionId: params.quoteVersionId,
    lineItemId: params.lineItemId,
    quoteLocalPacketId: params.quoteLocalPacketId,
    localLineKey: params.localLineKey,
    quantityIndex: params.quantityIndex,
    targetNodeKey: params.targetNodeKey,
  };
  return `pt_${hash20(tuple)}`;
}

function hash20(tuple: Record<string, unknown>): string {
  const json = JSON.stringify(tuple, Object.keys(tuple).sort());
  return createHash("sha256").update(json).digest("hex").slice(0, 20);
}

export function computePackageTaskId(params: {
  quoteVersionId: string;
  nodeId: string;
  planTaskId: string;
}): string {
  const tuple = { v: 1, ...params };
  const json = JSON.stringify(tuple, Object.keys(tuple).sort());
  return `pk_${createHash("sha256").update(json).digest("hex").slice(0, 20)}`;
}
