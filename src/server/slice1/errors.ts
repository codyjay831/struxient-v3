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
  // Canon picker contract: QuoteLineItem.scopePacketRevisionId may only point
  // at a PUBLISHED ScopePacketRevision. Enforced at the line-item server boundary
  // so direct API callers cannot pin a DRAFT revision (e.g. one freshly created
  // by the interim one-step promotion flow).
  // Canon: docs/canon/05-packet-canon.md ("PUBLISHED revision discipline for pickers"),
  // docs/implementation/decision-packs/interim-packet-promotion-decision-pack.md §7.
  | "LINE_SCOPE_REVISION_NOT_PUBLISHED"
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
  | "PINNED_WORKFLOW_VERSION_NOT_PUBLISHED"
  | "TASK_DEFINITION_NOT_FOUND"
  | "TASK_DEFINITION_TASK_KEY_INVALID"
  | "TASK_DEFINITION_DISPLAY_NAME_INVALID"
  | "TASK_DEFINITION_INSTRUCTIONS_TOO_LONG"
  | "TASK_DEFINITION_TASK_KEY_TAKEN"
  | "TASK_DEFINITION_NOT_DRAFT"
  | "TASK_DEFINITION_INVALID_STATUS_TRANSITION"
  | "TASK_DEFINITION_REQUIREMENTS_INVALID"
  | "TASK_DEFINITION_CONDITIONAL_RULES_INVALID"
  | "QUOTE_LOCAL_PACKET_INVALID_DISPLAY_NAME"
  | "QUOTE_LOCAL_PACKET_INVALID_DESCRIPTION"
  | "QUOTE_LOCAL_PACKET_HAS_PINNING_LINES"
  | "QUOTE_LOCAL_PACKET_ITEM_NOT_FOUND"
  | "QUOTE_LOCAL_PACKET_ITEM_INVALID_LINE_KEY"
  | "QUOTE_LOCAL_PACKET_ITEM_LINE_KEY_TAKEN"
  | "QUOTE_LOCAL_PACKET_ITEM_INVALID_SORT_ORDER"
  | "QUOTE_LOCAL_PACKET_ITEM_INVALID_TARGET_NODE_KEY"
  | "QUOTE_LOCAL_PACKET_ITEM_INVALID_TIER_CODE"
  | "QUOTE_LOCAL_PACKET_ITEM_INVALID_LINE_KIND"
  | "QUOTE_LOCAL_PACKET_ITEM_INVALID_EMBEDDED_PAYLOAD"
  | "QUOTE_LOCAL_PACKET_ITEM_TASK_DEFINITION_NOT_FOUND"
  // Interim one-step promotion flow (canon: docs/canon/05-packet-canon.md,
  // docs/implementation/decision-packs/interim-packet-promotion-decision-pack.md).
  | "QUOTE_LOCAL_PACKET_PROMOTION_INVALID_PACKET_KEY"
  | "QUOTE_LOCAL_PACKET_PROMOTION_PACKET_KEY_TAKEN"
  | "QUOTE_LOCAL_PACKET_PROMOTION_ALREADY_PROMOTED"
  | "QUOTE_LOCAL_PACKET_PROMOTION_SOURCE_HAS_NO_ITEMS"
  | "QUOTE_LOCAL_PACKET_PROMOTION_INVALID_DISPLAY_NAME"
  // Interim publish action for ScopePacketRevision (canon: docs/canon/05-packet-canon.md
  // "Canon amendment — interim publish authority", docs/implementation/decision-packs/
  // interim-publish-authority-decision-pack.md). All three are state-conflicts between
  // the requested DRAFT → PUBLISHED transition and the current state of the resource;
  // each maps to 409 Conflict.
  | "SCOPE_PACKET_REVISION_PUBLISH_NOT_DRAFT"
  | "SCOPE_PACKET_REVISION_PUBLISH_NOT_READY"
  | "SCOPE_PACKET_REVISION_PUBLISH_PACKET_HAS_PUBLISHED"
  // Quote-local fork from a PUBLISHED ScopePacketRevision (canon-05 §100-101
  // "Task mutation (mandatory fork)", bridge-decision 03 "Packet Fork /
  // Promotion"). Inverse of the interim promotion mapping; deep-copies
  // PacketTaskLine rows into a new QuoteLocalPacket with originType =
  // FORK_FROM_LIBRARY. Source must be PUBLISHED (the only canon-blessed
  // library state); empty source rejected to match the promotion-side rule.
  | "SCOPE_PACKET_REVISION_FORK_NOT_PUBLISHED"
  | "SCOPE_PACKET_REVISION_FORK_SOURCE_HAS_NO_ITEMS";

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
