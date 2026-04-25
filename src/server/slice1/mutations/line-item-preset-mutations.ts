import { Prisma, type PrismaClient, type QuoteLineItemExecutionMode } from "@prisma/client";
import { InvariantViolationError } from "../errors";
import {
  getLineItemPresetDetailForTenant,
  type LineItemPresetDetailDto,
} from "../reads/line-item-preset-reads";

/**
 * Tenant-scoped write surface for `LineItemPreset` (Phase 2 — Saved Line Items,
 * Slice 3).
 *
 * Hard rules (locked across Slice 1/2/3):
 *   - Preset = commercial defaults ONLY.
 *   - Preset NEVER participates in execution (no compose, no activation, no
 *     RuntimeTask side-effects).
 *   - Preset references the **parent** `ScopePacket`, never a revision.
 *   - MANIFEST mode REQUIRES `defaultScopePacketId` (non-null, tenant-owned).
 *   - SOLD_SCOPE mode FORBIDS `defaultScopePacketId` (must be null).
 *   - Cross-tenant probes return `LINE_ITEM_PRESET_PACKET_TENANT_MISMATCH`
 *     (mapped to 404 in `tenant-json.ts`) so callers cannot distinguish
 *     "missing in my tenant" from "exists in another tenant".
 *
 * The save path does NOT validate that the linked packet has a published
 * revision — that is a selection-time concern handled in Slice 2 by
 * `quote-line-item-prefill`. The admin form surfaces the same advisory copy
 * inline so authors know presets pointing at unpublished packets cannot be
 * picked yet.
 *
 * Returned DTOs round-trip through `getLineItemPresetDetailForTenant` so write
 * responses are byte-identical to GET responses.
 */

/* ─────────────────────── per-field validation limits ────────────────────── */

const MAX_DISPLAY_NAME = 200;
const MAX_PRESET_KEY = 80;
/** Mirrors `MAX_TITLE` in `quote-line-item-mutations.ts`. */
const MAX_DEFAULT_TITLE = 500;
/** Mirrors `MAX_DESCRIPTION` in `quote-line-item-mutations.ts`. */
const MAX_DEFAULT_DESCRIPTION = 4000;
/** Mirrors `MAX_GATE_TITLE_OVERRIDE` in `derive-payment-gate-intent-for-freeze.ts`. */
const MAX_GATE_TITLE_OVERRIDE = 120;

/** Stable handle character class — same shape as `packetKey` (lowercase ascii + digits + `-_`). */
const PRESET_KEY_REGEX = /^[a-z0-9_-]+$/;

const EXECUTION_MODES: ReadonlyArray<QuoteLineItemExecutionMode> = ["MANIFEST", "SOLD_SCOPE"];

/* ─────────────────────────── per-field validators ───────────────────────── */

function assertDisplayName(raw: unknown): string {
  if (typeof raw !== "string") {
    throw new InvariantViolationError(
      "LINE_ITEM_PRESET_DISPLAY_NAME_INVALID",
      "displayName must be a string.",
    );
  }
  const t = raw.trim();
  if (t.length === 0) {
    throw new InvariantViolationError(
      "LINE_ITEM_PRESET_DISPLAY_NAME_INVALID",
      "displayName must be non-empty after trim.",
    );
  }
  if (t.length > MAX_DISPLAY_NAME) {
    throw new InvariantViolationError(
      "LINE_ITEM_PRESET_DISPLAY_NAME_INVALID",
      `displayName must be at most ${MAX_DISPLAY_NAME} characters.`,
    );
  }
  return t;
}

/**
 * Optional `presetKey`: empty / whitespace / null / undefined → `null` (clear).
 * Non-empty must match `PRESET_KEY_REGEX` and fit within `MAX_PRESET_KEY`.
 */
function assertOptionalPresetKey(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "string") {
    throw new InvariantViolationError(
      "LINE_ITEM_PRESET_KEY_INVALID",
      "presetKey must be a string, null, or omitted.",
    );
  }
  const t = raw.trim();
  if (t.length === 0) return null;
  if (t.length > MAX_PRESET_KEY) {
    throw new InvariantViolationError(
      "LINE_ITEM_PRESET_KEY_INVALID",
      `presetKey must be at most ${MAX_PRESET_KEY} characters.`,
    );
  }
  if (!PRESET_KEY_REGEX.test(t)) {
    throw new InvariantViolationError(
      "LINE_ITEM_PRESET_KEY_INVALID",
      "presetKey may only contain lowercase letters, digits, hyphens, and underscores.",
    );
  }
  return t;
}

function assertOptionalDefaultTitle(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "string") {
    throw new InvariantViolationError(
      "LINE_ITEM_PRESET_TITLE_INVALID",
      "defaultTitle must be a string, null, or omitted.",
    );
  }
  const t = raw.trim();
  if (t.length === 0) return null;
  if (t.length > MAX_DEFAULT_TITLE) {
    throw new InvariantViolationError(
      "LINE_ITEM_PRESET_TITLE_INVALID",
      `defaultTitle must be at most ${MAX_DEFAULT_TITLE} characters.`,
    );
  }
  return t;
}

function assertOptionalDefaultDescription(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "string") {
    throw new InvariantViolationError(
      "LINE_ITEM_PRESET_DESCRIPTION_INVALID",
      "defaultDescription must be a string, null, or omitted.",
    );
  }
  const t = raw.trim();
  if (t.length === 0) return null;
  if (t.length > MAX_DEFAULT_DESCRIPTION) {
    throw new InvariantViolationError(
      "LINE_ITEM_PRESET_DESCRIPTION_INVALID",
      `defaultDescription must be at most ${MAX_DEFAULT_DESCRIPTION} characters.`,
    );
  }
  return t;
}

function assertOptionalDefaultQuantity(raw: unknown): number | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 1) {
    throw new InvariantViolationError(
      "LINE_ITEM_PRESET_QUANTITY_INVALID",
      "defaultQuantity must be an integer ≥ 1.",
      { defaultQuantity: raw },
    );
  }
  return raw;
}

function assertOptionalDefaultUnitPriceCents(raw: unknown): number | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 0) {
    throw new InvariantViolationError(
      "LINE_ITEM_PRESET_PRICE_INVALID",
      "defaultUnitPriceCents must be a non-negative integer (cents).",
      { defaultUnitPriceCents: raw },
    );
  }
  return raw;
}

function assertOptionalDefaultPaymentBeforeWork(raw: unknown): boolean | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "boolean") {
    // No dedicated code — payment-before-work shape errors are rare and the
    // closest semantic bucket is "this preset's commercial defaults are
    // malformed". Reuse the gate-title bucket for symmetry with the existing
    // mutation surface.
    throw new InvariantViolationError(
      "LINE_ITEM_PRESET_GATE_TITLE_TOO_LONG",
      "defaultPaymentBeforeWork must be a boolean, null, or omitted.",
    );
  }
  return raw;
}

function assertOptionalDefaultPaymentGateTitleOverride(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "string") {
    throw new InvariantViolationError(
      "LINE_ITEM_PRESET_GATE_TITLE_TOO_LONG",
      "defaultPaymentGateTitleOverride must be a string, null, or omitted.",
    );
  }
  const t = raw.trim();
  if (t.length === 0) return null;
  if (t.length > MAX_GATE_TITLE_OVERRIDE) {
    throw new InvariantViolationError(
      "LINE_ITEM_PRESET_GATE_TITLE_TOO_LONG",
      `defaultPaymentGateTitleOverride must be at most ${MAX_GATE_TITLE_OVERRIDE} characters.`,
    );
  }
  return t;
}

function assertExecutionMode(raw: unknown): QuoteLineItemExecutionMode {
  if (typeof raw !== "string" || !EXECUTION_MODES.includes(raw as QuoteLineItemExecutionMode)) {
    // Re-uses the displayName-invalid bucket for parse failures — the route
    // layer normally rejects bad executionMode at the API boundary with a
    // generic INVALID_FIELD 400, so this branch is defense-in-depth for direct
    // service callers. Carrying its own dedicated invariant code would balloon
    // the enum without meaningful new semantics.
    throw new InvariantViolationError(
      "LINE_ITEM_PRESET_DISPLAY_NAME_INVALID",
      "defaultExecutionMode must be 'MANIFEST' or 'SOLD_SCOPE'.",
      { defaultExecutionMode: raw },
    );
  }
  return raw as QuoteLineItemExecutionMode;
}

/**
 * Optional `defaultScopePacketId` parser.
 *
 * - `undefined` → "leave untouched" (returned as `undefined`); the caller
 *   resolves the post-patch state before the MANIFEST/SOLD_SCOPE invariant
 *   runs.
 * - `null` → "clear" (returned as `null`); allowed for SOLD_SCOPE.
 * - non-empty string → keep as-is; tenant ownership is checked separately.
 */
function parseOptionalDefaultScopePacketId(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw !== "string") {
    throw new InvariantViolationError(
      "LINE_ITEM_PRESET_PACKET_TENANT_MISMATCH",
      "defaultScopePacketId must be a string, null, or omitted.",
    );
  }
  const t = raw.trim();
  if (t.length === 0) return null;
  return t;
}

/**
 * Confirms a packet id belongs to the tenant. Cross-tenant probes and outright
 * misses both throw `LINE_ITEM_PRESET_PACKET_TENANT_MISMATCH` (404) so the
 * write surface never leaks "this id exists in another tenant".
 */
async function assertPacketBelongsToTenant(
  prisma: PrismaClient,
  tenantId: string,
  packetId: string,
): Promise<void> {
  const packet = await prisma.scopePacket.findFirst({
    where: { id: packetId, tenantId },
    select: { id: true },
  });
  if (!packet) {
    throw new InvariantViolationError(
      "LINE_ITEM_PRESET_PACKET_TENANT_MISMATCH",
      "Packet does not exist in this tenant.",
      { defaultScopePacketId: packetId },
    );
  }
}

/**
 * Final invariant gate — runs against the **resolved** post-patch state for
 * both create and update so the rule cannot be circumvented by a partial
 * patch. Stays in lockstep with the read-side `LineItemPresetSummaryDto`
 * usability check in `quote-line-item-prefill.ts`.
 */
function assertExecutionModePacketShape(
  mode: QuoteLineItemExecutionMode,
  packetId: string | null,
): void {
  if (mode === "MANIFEST") {
    if (packetId == null) {
      throw new InvariantViolationError(
        "LINE_ITEM_PRESET_MANIFEST_REQUIRES_PACKET",
        "MANIFEST presets must reference a Library packet.",
      );
    }
    return;
  }
  // SOLD_SCOPE
  if (packetId != null) {
    throw new InvariantViolationError(
      "LINE_ITEM_PRESET_SOLD_SCOPE_FORBIDS_PACKET",
      "SOLD_SCOPE presets cannot reference a Library packet.",
      { defaultScopePacketId: packetId },
    );
  }
}

/**
 * Maps Prisma's unique-violation (P2002) on `(tenantId, presetKey)` to the
 * canonical 409 invariant code. Other constraint violations rethrow.
 */
function rethrowAsKeyTakenIfP2002(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    const target = e.meta?.target;
    const targets = Array.isArray(target) ? (target as string[]) : [];
    if (targets.includes("presetKey") || targets.includes("tenantId")) {
      throw new InvariantViolationError(
        "LINE_ITEM_PRESET_KEY_TAKEN",
        "A preset with that key already exists in this tenant.",
      );
    }
  }
  throw e;
}

/* ───────────────────────────── public surface ───────────────────────────── */

export type CreateLineItemPresetInput = {
  tenantId: string;
  /** Captured for future audit. Not stored on the row in Slice 3. */
  userId: string;
  displayName: unknown;
  presetKey?: unknown;
  defaultTitle?: unknown;
  defaultDescription?: unknown;
  defaultExecutionMode: unknown;
  defaultScopePacketId?: unknown;
  defaultQuantity?: unknown;
  defaultUnitPriceCents?: unknown;
  defaultPaymentBeforeWork?: unknown;
  defaultPaymentGateTitleOverride?: unknown;
};

export async function createLineItemPresetForTenant(
  prisma: PrismaClient,
  input: CreateLineItemPresetInput,
): Promise<LineItemPresetDetailDto> {
  const displayName = assertDisplayName(input.displayName);
  const presetKey = assertOptionalPresetKey(input.presetKey);
  const defaultTitle = assertOptionalDefaultTitle(input.defaultTitle);
  const defaultDescription = assertOptionalDefaultDescription(input.defaultDescription);
  const defaultExecutionMode = assertExecutionMode(input.defaultExecutionMode);
  const defaultQuantity = assertOptionalDefaultQuantity(input.defaultQuantity);
  const defaultUnitPriceCents = assertOptionalDefaultUnitPriceCents(input.defaultUnitPriceCents);
  const defaultPaymentBeforeWork = assertOptionalDefaultPaymentBeforeWork(input.defaultPaymentBeforeWork);
  const defaultPaymentGateTitleOverride = assertOptionalDefaultPaymentGateTitleOverride(
    input.defaultPaymentGateTitleOverride,
  );

  // Packet id parse — `undefined` collapses to `null` for create (nothing to
  // preserve), so the invariant gate sees the same shape as the eventual row.
  const parsedPacket = parseOptionalDefaultScopePacketId(input.defaultScopePacketId);
  const defaultScopePacketId = parsedPacket === undefined ? null : parsedPacket;

  assertExecutionModePacketShape(defaultExecutionMode, defaultScopePacketId);

  if (defaultScopePacketId != null) {
    await assertPacketBelongsToTenant(prisma, input.tenantId, defaultScopePacketId);
  }

  let createdId: string;
  try {
    const created = await prisma.lineItemPreset.create({
      data: {
        tenantId: input.tenantId,
        presetKey,
        displayName,
        defaultTitle,
        defaultDescription,
        defaultExecutionMode,
        defaultScopePacketId,
        defaultQuantity,
        defaultUnitPriceCents,
        defaultPaymentBeforeWork,
        defaultPaymentGateTitleOverride,
      },
      select: { id: true },
    });
    createdId = created.id;
  } catch (e) {
    rethrowAsKeyTakenIfP2002(e);
  }

  const detail = await getLineItemPresetDetailForTenant(prisma, {
    tenantId: input.tenantId,
    // Re-read by id (tenant-scoped). createdId is set in the try block above
    // and the catch always rethrows, so reaching here implies success.
    presetId: createdId!,
  });
  if (!detail) {
    // Defensive — same pattern as `createQuoteLocalPacketForTenant`. Should be
    // unreachable: we just inserted the row in this tenant.
    throw new InvariantViolationError(
      "LINE_ITEM_PRESET_NOT_FOUND",
      "Created LineItemPreset could not be re-read in tenant scope.",
      { lineItemPresetId: createdId! },
    );
  }
  return detail;
}

export type UpdateLineItemPresetInput = {
  tenantId: string;
  lineItemPresetId: string;
  /** Captured for future audit. Not stored on the row in Slice 3. */
  userId: string;
  // `undefined` means "do not touch"; `null` means "clear" for nullable cols.
  displayName?: unknown;
  presetKey?: unknown;
  defaultTitle?: unknown;
  defaultDescription?: unknown;
  defaultExecutionMode?: unknown;
  defaultScopePacketId?: unknown;
  defaultQuantity?: unknown;
  defaultUnitPriceCents?: unknown;
  defaultPaymentBeforeWork?: unknown;
  defaultPaymentGateTitleOverride?: unknown;
};

export async function updateLineItemPresetForTenant(
  prisma: PrismaClient,
  input: UpdateLineItemPresetInput,
): Promise<LineItemPresetDetailDto | "not_found"> {
  const existing = await prisma.lineItemPreset.findFirst({
    where: { id: input.lineItemPresetId, tenantId: input.tenantId },
    select: {
      id: true,
      defaultExecutionMode: true,
      defaultScopePacketId: true,
    },
  });
  if (!existing) return "not_found";

  // Per-field validation. Each helper returns `null` for "clear" and a value
  // for "set"; we promote the absence of the property to `undefined` ("leave
  // untouched") to keep the Prisma update payload minimal.
  const data: Prisma.LineItemPresetUpdateInput = {};

  if (input.displayName !== undefined) {
    data.displayName = assertDisplayName(input.displayName);
  }
  if (input.presetKey !== undefined) {
    data.presetKey = assertOptionalPresetKey(input.presetKey);
  }
  if (input.defaultTitle !== undefined) {
    data.defaultTitle = assertOptionalDefaultTitle(input.defaultTitle);
  }
  if (input.defaultDescription !== undefined) {
    data.defaultDescription = assertOptionalDefaultDescription(input.defaultDescription);
  }
  if (input.defaultQuantity !== undefined) {
    data.defaultQuantity = assertOptionalDefaultQuantity(input.defaultQuantity);
  }
  if (input.defaultUnitPriceCents !== undefined) {
    data.defaultUnitPriceCents = assertOptionalDefaultUnitPriceCents(input.defaultUnitPriceCents);
  }
  if (input.defaultPaymentBeforeWork !== undefined) {
    data.defaultPaymentBeforeWork = assertOptionalDefaultPaymentBeforeWork(
      input.defaultPaymentBeforeWork,
    );
  }
  if (input.defaultPaymentGateTitleOverride !== undefined) {
    data.defaultPaymentGateTitleOverride = assertOptionalDefaultPaymentGateTitleOverride(
      input.defaultPaymentGateTitleOverride,
    );
  }

  // Resolve post-patch (mode, packetId) pair so the invariant runs against the
  // shape that will actually be persisted, not against whatever subset the
  // caller happened to send.
  const nextMode: QuoteLineItemExecutionMode =
    input.defaultExecutionMode === undefined
      ? existing.defaultExecutionMode
      : assertExecutionMode(input.defaultExecutionMode);
  if (input.defaultExecutionMode !== undefined) {
    data.defaultExecutionMode = nextMode;
  }

  const parsedPacket = parseOptionalDefaultScopePacketId(input.defaultScopePacketId);
  const nextPacketId: string | null =
    parsedPacket === undefined ? existing.defaultScopePacketId : parsedPacket;
  if (input.defaultScopePacketId !== undefined) {
    // Prisma's update input for an optional FK requires the relation form
    // (`connect` / `disconnect`) on `LineItemPresetUpdateInput`, not the bare
    // scalar `defaultScopePacketId`. We translate the parsed value into the
    // appropriate relation operation here. Tenant ownership of the target
    // packet is verified separately below.
    data.defaultScopePacket =
      parsedPacket === null ? { disconnect: true } : { connect: { id: parsedPacket } };
  }

  assertExecutionModePacketShape(nextMode, nextPacketId);

  if (
    nextPacketId != null &&
    // Only verify tenant ownership when the packet id is changing or being set
    // for the first time. Re-checking on every untouched-packet update is
    // unnecessary and adds a round trip.
    nextPacketId !== existing.defaultScopePacketId
  ) {
    await assertPacketBelongsToTenant(prisma, input.tenantId, nextPacketId);
  }

  try {
    await prisma.lineItemPreset.update({
      where: { id: existing.id },
      data,
      select: { id: true },
    });
  } catch (e) {
    rethrowAsKeyTakenIfP2002(e);
  }

  const detail = await getLineItemPresetDetailForTenant(prisma, {
    tenantId: input.tenantId,
    presetId: existing.id,
  });
  if (!detail) {
    throw new InvariantViolationError(
      "LINE_ITEM_PRESET_NOT_FOUND",
      "Updated LineItemPreset could not be re-read in tenant scope.",
      { lineItemPresetId: existing.id },
    );
  }
  return detail;
}

export type DeleteLineItemPresetInput = {
  tenantId: string;
  lineItemPresetId: string;
  /** Captured for future audit. Not stored on the row in Slice 3. */
  userId: string;
};

export async function deleteLineItemPresetForTenant(
  prisma: PrismaClient,
  input: DeleteLineItemPresetInput,
): Promise<{ deleted: true } | "not_found"> {
  // Tenant-scoped probe first so cross-tenant deletes return `not_found`
  // (matches the rest of slice1's mutation surface and avoids info leak).
  const existing = await prisma.lineItemPreset.findFirst({
    where: { id: input.lineItemPresetId, tenantId: input.tenantId },
    select: { id: true },
  });
  if (!existing) return "not_found";

  await prisma.lineItemPreset.delete({ where: { id: existing.id } });
  return { deleted: true };
}
