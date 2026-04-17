/**
 * Service-layer invariant failures for Slice 1 (pre-job, quote-local, line scope).
 * Prefer throwing these over silent coercion or generic Error strings.
 */

export type Slice1InvariantCode =
  | "MANIFEST_SCOPE_PIN_XOR"
  | "PREJOB_TENANT_FLOWGROUP_MISMATCH"
  | "PREJOB_QUOTE_VERSION_TENANT_MISMATCH"
  | "PREJOB_QUOTE_VERSION_FLOWGROUP_MISMATCH"
  | "LINE_PROPOSAL_GROUP_VERSION_MISMATCH"
  | "LINE_SCOPE_REVISION_TENANT_MISMATCH"
  | "LINE_LOCAL_PACKET_VERSION_MISMATCH"
  | "LINE_LOCAL_PACKET_TENANT_MISMATCH"
  | "QUOTE_LOCAL_PACKET_TENANT_MISMATCH"
  | "QUOTE_LOCAL_PACKET_ITEM_LIBRARY_WITHOUT_DEFINITION"
  | "QUOTE_LOCAL_PACKET_ITEM_EMBEDDED_WITHOUT_PAYLOAD"
  | "READ_MODEL_INVARIANT_FAILURE"
  | "QUOTE_VERSION_NOT_DRAFT"
  | "PROPOSAL_GROUP_VERSION_MISMATCH"
  | "INVALID_PROPOSAL_GROUP_NAME"
  | "INVALID_LINE_QUANTITY"
  | "INVALID_LINE_SORT_ORDER"
  | "INVALID_LINE_TITLE"
  | "INVALID_LINE_DESCRIPTION"
  | "INVALID_LINE_MONEY"
  | "SCOPE_PACKET_REVISION_NOT_FOUND"
  | "QUOTE_LOCAL_PACKET_NOT_FOUND"
  | "PINNED_WORKFLOW_VERSION_NOT_FOUND"
  | "PINNED_WORKFLOW_VERSION_NOT_PUBLISHED";

export class InvariantViolationError extends Error {
  readonly code: Slice1InvariantCode;

  readonly context?: Record<string, unknown>;

  constructor(code: Slice1InvariantCode, message: string, context?: Record<string, unknown>) {
    super(message);
    this.name = "InvariantViolationError";
    this.code = code;
    this.context = context;
  }
}
