/**
 * Pure parsers/validators for QuoteLocalPacket and QuoteLocalPacketItem authoring inputs.
 *
 * Lives in src/lib so it can be unit-tested without Prisma; the mutation layer
 * applies these together with service-level invariants in
 * src/server/slice1/invariants/quote-local-packet*.ts.
 *
 * Canon refs: docs/canon/05-packet-canon.md, docs/epics/15-scope-packets-epic.md,
 * docs/epics/16-packet-task-lines-epic.md.
 */

import { InvariantViolationError } from "@/server/slice1/errors";

const MAX_DISPLAY_NAME = 200;
const MAX_DESCRIPTION = 4000;
const MAX_LINE_KEY = 80;
const MAX_TIER_CODE = 40;
const MAX_TARGET_NODE_KEY = 200;
const LINE_KEY_PATTERN = /^[a-zA-Z0-9_.:-]+$/;

const MIN_PACKET_KEY = 2;
const MAX_PACKET_KEY = 80;
// Slug-like: lowercase letters, digits, hyphens; must start/end alphanumeric.
// Matches the documented "stable key, slug-like" rule for ScopePacket.packetKey
// in docs/schema-slice-1/03-slice-1-field-definitions.md.
const PACKET_KEY_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export type ParsedDisplayName = string;
export type ParsedDescription = string | null;
export type ParsedLineKey = string;
export type ParsedTierCode = string | null;
export type ParsedTargetNodeKey = string;
export type ParsedPacketKey = string;

export type QuoteLocalPacketLineKindLiteral = "EMBEDDED" | "LIBRARY";

export function assertDisplayName(raw: unknown): ParsedDisplayName {
  if (typeof raw !== "string") {
    throw new InvariantViolationError(
      "QUOTE_LOCAL_PACKET_INVALID_DISPLAY_NAME",
      "displayName must be a string.",
    );
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new InvariantViolationError(
      "QUOTE_LOCAL_PACKET_INVALID_DISPLAY_NAME",
      "displayName must be non-empty after trim.",
    );
  }
  if (trimmed.length > MAX_DISPLAY_NAME) {
    throw new InvariantViolationError(
      "QUOTE_LOCAL_PACKET_INVALID_DISPLAY_NAME",
      `displayName must be at most ${MAX_DISPLAY_NAME} characters.`,
    );
  }
  return trimmed;
}

export function assertOptionalDescription(raw: unknown): ParsedDescription {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "string") {
    throw new InvariantViolationError(
      "QUOTE_LOCAL_PACKET_INVALID_DESCRIPTION",
      "description must be a string or null.",
    );
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > MAX_DESCRIPTION) {
    throw new InvariantViolationError(
      "QUOTE_LOCAL_PACKET_INVALID_DESCRIPTION",
      `description must be at most ${MAX_DESCRIPTION} characters.`,
    );
  }
  return trimmed;
}

export function assertLineKey(raw: unknown): ParsedLineKey {
  if (typeof raw !== "string") {
    throw new InvariantViolationError(
      "QUOTE_LOCAL_PACKET_ITEM_INVALID_LINE_KEY",
      "lineKey must be a string.",
    );
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new InvariantViolationError(
      "QUOTE_LOCAL_PACKET_ITEM_INVALID_LINE_KEY",
      "lineKey must be non-empty after trim.",
    );
  }
  if (trimmed.length > MAX_LINE_KEY) {
    throw new InvariantViolationError(
      "QUOTE_LOCAL_PACKET_ITEM_INVALID_LINE_KEY",
      `lineKey must be at most ${MAX_LINE_KEY} characters.`,
    );
  }
  if (!LINE_KEY_PATTERN.test(trimmed)) {
    throw new InvariantViolationError(
      "QUOTE_LOCAL_PACKET_ITEM_INVALID_LINE_KEY",
      "lineKey may contain only letters, digits, underscore, dot, colon, or hyphen.",
    );
  }
  return trimmed;
}

export function assertSortOrder(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isInteger(raw)) {
    throw new InvariantViolationError(
      "QUOTE_LOCAL_PACKET_ITEM_INVALID_SORT_ORDER",
      "sortOrder must be an integer.",
    );
  }
  if (raw < 0) {
    throw new InvariantViolationError(
      "QUOTE_LOCAL_PACKET_ITEM_INVALID_SORT_ORDER",
      "sortOrder must be >= 0.",
    );
  }
  return raw;
}

export function assertOptionalTierCode(raw: unknown): ParsedTierCode {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "string") {
    throw new InvariantViolationError(
      "QUOTE_LOCAL_PACKET_ITEM_INVALID_TIER_CODE",
      "tierCode must be a string or null.",
    );
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > MAX_TIER_CODE) {
    throw new InvariantViolationError(
      "QUOTE_LOCAL_PACKET_ITEM_INVALID_TIER_CODE",
      `tierCode must be at most ${MAX_TIER_CODE} characters.`,
    );
  }
  return trimmed;
}

export function assertTargetNodeKey(raw: unknown): ParsedTargetNodeKey {
  if (typeof raw !== "string") {
    throw new InvariantViolationError(
      "QUOTE_LOCAL_PACKET_ITEM_INVALID_TARGET_NODE_KEY",
      "targetNodeKey must be a string.",
    );
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new InvariantViolationError(
      "QUOTE_LOCAL_PACKET_ITEM_INVALID_TARGET_NODE_KEY",
      "targetNodeKey must be non-empty after trim.",
    );
  }
  if (trimmed.length > MAX_TARGET_NODE_KEY) {
    throw new InvariantViolationError(
      "QUOTE_LOCAL_PACKET_ITEM_INVALID_TARGET_NODE_KEY",
      `targetNodeKey must be at most ${MAX_TARGET_NODE_KEY} characters.`,
    );
  }
  return trimmed;
}

export function assertLineKind(raw: unknown): QuoteLocalPacketLineKindLiteral {
  if (raw !== "EMBEDDED" && raw !== "LIBRARY") {
    throw new InvariantViolationError(
      "QUOTE_LOCAL_PACKET_ITEM_INVALID_LINE_KIND",
      "lineKind must be 'EMBEDDED' or 'LIBRARY'.",
    );
  }
  return raw;
}

/**
 * Embedded payload shape consumed by compose-engine.readEmbeddedScopeFields:
 * { title?, taskKind?, instructions?, completionRequirementsJson?, conditionalRulesJson? }.
 *
 * We accept a JSON object (may be empty) and reject arrays/scalars. We do not
 * validate or normalize the inner shape here — compose-engine already does
 * defensive reads, and we keep authored truth flexible.
 */
export function assertOptionalEmbeddedPayload(raw: unknown): Record<string, unknown> | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new InvariantViolationError(
      "QUOTE_LOCAL_PACKET_ITEM_INVALID_EMBEDDED_PAYLOAD",
      "embeddedPayloadJson must be a JSON object (or null).",
    );
  }
  return raw as Record<string, unknown>;
}

/**
 * Estimator-supplied `packetKey` for the interim one-step promotion flow.
 * Slug-like, lowercase, hyphen-separated. Server-validated; tenant-uniqueness
 * is checked separately in the mutation.
 *
 * Canon: docs/canon/05-packet-canon.md, docs/implementation/decision-packs/interim-packet-promotion-decision-pack.md §5.
 */
export function assertPacketKey(raw: unknown): ParsedPacketKey {
  if (typeof raw !== "string") {
    throw new InvariantViolationError(
      "QUOTE_LOCAL_PACKET_PROMOTION_INVALID_PACKET_KEY",
      "packetKey must be a string.",
    );
  }
  const trimmed = raw.trim();
  if (trimmed.length < MIN_PACKET_KEY) {
    throw new InvariantViolationError(
      "QUOTE_LOCAL_PACKET_PROMOTION_INVALID_PACKET_KEY",
      `packetKey must be at least ${MIN_PACKET_KEY} characters after trim.`,
    );
  }
  if (trimmed.length > MAX_PACKET_KEY) {
    throw new InvariantViolationError(
      "QUOTE_LOCAL_PACKET_PROMOTION_INVALID_PACKET_KEY",
      `packetKey must be at most ${MAX_PACKET_KEY} characters.`,
    );
  }
  if (!PACKET_KEY_PATTERN.test(trimmed)) {
    throw new InvariantViolationError(
      "QUOTE_LOCAL_PACKET_PROMOTION_INVALID_PACKET_KEY",
      "packetKey must be lowercase letters, digits, or hyphens; must start and end with an alphanumeric.",
    );
  }
  return trimmed;
}

export function assertOptionalTaskDefinitionId(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "string") {
    throw new InvariantViolationError(
      "QUOTE_LOCAL_PACKET_ITEM_TASK_DEFINITION_NOT_FOUND",
      "taskDefinitionId must be a string or null.",
    );
  }
  const trimmed = raw.trim();
  return trimmed.length === 0 ? null : trimmed;
}
