/**
 * Pure prefill helpers for the Quote Scope editor (Triangle Mode — Phase 2,
 * Slice 2).
 *
 * The scope editor's "Quick Add" panel can prefill the existing line-item
 * authoring form from two distinct catalog sources:
 *
 *   1. A library `ScopePacket` summary (Phase 1, Slice 1 — already shipping).
 *   2. A `LineItemPreset` summary (Phase 2, Slice 2 — this slice).
 *
 * Both flows funnel into the **same** `FormFields` shape that the existing
 * `<LineItemForm/>` consumes. They never bypass the form — the user still
 * clicks "Create line item", and the existing client-side validation +
 * server-side mutation invariants (`MANIFEST_SCOPE_PIN_XOR`,
 * PUBLISHED-revision discipline, tenant alignment) are still authoritative.
 *
 * This module is intentionally:
 *   - **Pure**: no React, no Prisma, no fetch, no `setState`. The scope
 *     editor is the only caller and threads results into its own state.
 *   - **Decision-aware**: a preset can be "unusable" for the picker
 *     (MANIFEST mode + missing packet OR missing PUBLISHED revision). The
 *     helper returns a discriminated `{ ok: false, reason }` shape so the
 *     picker can disable the row and surface a precise tooltip without the
 *     scope editor needing to re-derive the same logic.
 *
 * Title / packet / payment rules — locked to the Slice 2 spec:
 *   - `title`         : preset value wins **only when the staged title is
 *                       empty after trim**. Never overwrites user input.
 *   - `description`   : preset value always wins (the form exposes a
 *                       textarea the user can re-edit before submit).
 *   - `quantity`      : preset value wins; `null` falls back to `"1"`.
 *   - `unitPriceCents`: preset value wins; `null` falls back to `""`.
 *   - `paymentBeforeWork` / `paymentGateTitleOverride`: preset values win,
 *                       fall back to `false` / `""` respectively.
 *   - MANIFEST       : `packetSource = "library"`, `scopePacketRevisionId =
 *                       packet.latestPublishedRevisionId`,
 *                       `quoteLocalPacketId = ""`.
 *   - SOLD_SCOPE     : `packetSource = "none"`, both packet ids cleared.
 *
 * Canon refs:
 *   - docs/canon/04-quote-line-item-canon.md  (commercial/execution split)
 *   - docs/canon/05-packet-canon.md           (PUBLISHED revision discipline)
 */

import type { LineItemPresetSummaryDto } from "@/server/slice1/reads/line-item-preset-reads";
import type { ScopePacketSummaryDto } from "@/server/slice1/reads/scope-packet-catalog-reads";

export type PrefillExecutionMode = "SOLD_SCOPE" | "MANIFEST";
export type PrefillPacketSource = "none" | "library" | "local";

/**
 * Subset of the scope editor's `FormFields` that the prefill helpers
 * produce. The scope editor merges this into its full `FormFields` (which
 * also carries `proposalGroupId`, an editor-level concern). Keeping the
 * helper output strictly to the prefilled subset means it can never
 * accidentally clobber `proposalGroupId`.
 */
export type PrefilledFields = {
  title: string;
  description: string;
  quantity: string;
  executionMode: PrefillExecutionMode;
  unitPriceCents: string;
  paymentBeforeWork: boolean;
  paymentGateTitleOverride: string;
  packetSource: PrefillPacketSource;
  scopePacketRevisionId: string;
  quoteLocalPacketId: string;
};

/**
 * Minimal staged-fields shape the helpers read from. The scope editor's
 * `FormFields` is a superset — passing it in is fine; passing `undefined`
 * means "no prior staged input", which the helpers treat as a fresh form.
 */
export type StagedFieldsForPrefill = Pick<PrefilledFields, "title" | "quantity">;

/**
 * "Why this preset can't be used right now" reasons the picker surfaces
 * inline. `manifest_packet_missing` covers the `SetNull` case — the parent
 * `ScopePacket` was deleted, so `defaultScopePacket` came back null even
 * though `defaultExecutionMode === "MANIFEST"`. `manifest_no_published_revision`
 * is the more common case where the packet exists but has zero PUBLISHED
 * revisions (Phase 1 invariant: a quote line item can only pin a PUBLISHED
 * revision).
 */
export type PresetUnusableReason =
  | "manifest_packet_missing"
  | "manifest_no_published_revision";

export type PresetPrefillResult =
  | { ok: true; fields: PrefilledFields }
  | { ok: false; reason: PresetUnusableReason };

/**
 * "Why this packet can't be used right now" reasons.
 * `no_published_revision` mirrors the picker's existing client-side filter:
 * a packet without `latestPublishedRevisionId` cannot be pinned.
 */
export type PacketUnusableReason = "no_published_revision";

export type PacketPrefillResult =
  | { ok: true; fields: PrefilledFields }
  | { ok: false; reason: PacketUnusableReason };

function preserveTitleOrUseFallback(
  staged: StagedFieldsForPrefill | undefined,
  fallback: string,
): string {
  const stagedTitle = staged?.title ?? "";
  return stagedTitle.trim() === "" ? fallback : stagedTitle;
}

function quantityFromPreset(value: number | null | undefined): string {
  if (value == null) return "1";
  return String(value);
}

function unitPriceFromPreset(value: number | null | undefined): string {
  if (value == null) return "";
  return String(value);
}

/**
 * Build the prefill subset for a `LineItemPreset` summary.
 *
 * For MANIFEST presets, the parent packet must (a) exist and (b) carry a
 * non-null `latestPublishedRevisionId`. Both conditions are surfaced as
 * discrete `ok: false` reasons so the picker can render a precise tooltip
 * (deleted packet vs. no PUBLISHED revision yet).
 *
 * For SOLD_SCOPE presets, no packet pin is possible by design — both
 * packet ids are always cleared regardless of `defaultScopePacket`.
 *
 * The returned `fields` are otherwise identical between modes; the only
 * differences are `executionMode`, `packetSource`, and the two packet ids.
 */
export function buildFieldsFromPreset(
  preset: LineItemPresetSummaryDto & {
    defaultTitle?: string | null;
    defaultDescription?: string | null;
    defaultQuantity?: number | null;
    defaultUnitPriceCents?: number | null;
    defaultPaymentBeforeWork?: boolean | null;
    defaultPaymentGateTitleOverride?: string | null;
  },
  staged: StagedFieldsForPrefill | undefined,
): PresetPrefillResult {
  const title = preserveTitleOrUseFallback(
    staged,
    preset.defaultTitle ?? preset.displayName,
  );
  const description = preset.defaultDescription ?? "";
  const quantity = quantityFromPreset(preset.defaultQuantity);
  const unitPriceCents = unitPriceFromPreset(preset.defaultUnitPriceCents);
  const paymentBeforeWork = preset.defaultPaymentBeforeWork ?? false;
  const paymentGateTitleOverride = preset.defaultPaymentGateTitleOverride ?? "";

  if (preset.defaultExecutionMode === "MANIFEST") {
    const packet = preset.defaultScopePacket;
    if (!packet) {
      return { ok: false, reason: "manifest_packet_missing" };
    }
    if (packet.latestPublishedRevisionId == null) {
      return { ok: false, reason: "manifest_no_published_revision" };
    }
    return {
      ok: true,
      fields: {
        title,
        description,
        quantity,
        executionMode: "MANIFEST",
        unitPriceCents,
        paymentBeforeWork,
        paymentGateTitleOverride,
        packetSource: "library",
        scopePacketRevisionId: packet.latestPublishedRevisionId,
        quoteLocalPacketId: "",
      },
    };
  }

  return {
    ok: true,
    fields: {
      title,
      description,
      quantity,
      executionMode: "SOLD_SCOPE",
      unitPriceCents,
      paymentBeforeWork,
      paymentGateTitleOverride,
      packetSource: "none",
      scopePacketRevisionId: "",
      quoteLocalPacketId: "",
    },
  };
}

/**
 * Build the prefill subset for a library `ScopePacket` summary.
 *
 * This is the existing Phase 1 / Slice 1 behavior, refactored out of
 * `prefillFromPacket` in `scope-editor.tsx` so the picker can use the same
 * `{ ok, reason }` discriminator the preset path uses (instead of the older
 * "silently no-op" path that just returned early).
 *
 * Phase 1 contract preserved exactly:
 *   - title preserved if non-empty, else `packet.displayName`.
 *   - quantity preserved if non-empty, else `"1"`.
 *   - description / unitPriceCents / payment* are NEVER set from a packet —
 *     a library packet has no commercial defaults. They fall back to the
 *     existing staged values (or "" / false when no value is staged).
 *   - executionMode forced to MANIFEST, packet pinned via library revision.
 */
export function buildFieldsFromPacket(
  packet: Pick<ScopePacketSummaryDto, "displayName" | "latestPublishedRevisionId">,
  staged: PrefilledFields | undefined,
): PacketPrefillResult {
  if (packet.latestPublishedRevisionId == null) {
    return { ok: false, reason: "no_published_revision" };
  }
  const title = preserveTitleOrUseFallback(staged, packet.displayName);
  const stagedQuantity = staged?.quantity ?? "";
  const quantity = stagedQuantity.trim() === "" ? "1" : stagedQuantity;
  return {
    ok: true,
    fields: {
      title,
      description: staged?.description ?? "",
      quantity,
      executionMode: "MANIFEST",
      unitPriceCents: staged?.unitPriceCents ?? "",
      paymentBeforeWork: staged?.paymentBeforeWork ?? false,
      paymentGateTitleOverride: staged?.paymentGateTitleOverride ?? "",
      packetSource: "library",
      scopePacketRevisionId: packet.latestPublishedRevisionId,
      quoteLocalPacketId: "",
    },
  };
}
