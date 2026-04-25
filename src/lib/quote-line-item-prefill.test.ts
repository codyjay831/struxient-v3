import { describe, expect, it } from "vitest";
import {
  buildFieldsFromPacket,
  buildFieldsFromPreset,
  type PrefilledFields,
  type StagedFieldsForPrefill,
} from "./quote-line-item-prefill";
import type { LineItemPresetSummaryDto } from "@/server/slice1/reads/line-item-preset-reads";

/**
 * Pure-function tests for the Slice 2 prefill helpers. No Prisma, no React,
 * no DATABASE_URL guard — these run on every `vitest` invocation.
 *
 * Coverage matrix:
 *   - MANIFEST preset + usable packet → ok
 *   - MANIFEST preset + missing packet → manifest_packet_missing
 *   - MANIFEST preset + packet w/o PUBLISHED revision → manifest_no_published_revision
 *   - SOLD_SCOPE preset → ok (regardless of packet ref)
 *   - SOLD_SCOPE preset accidentally carrying a packet ref → packet ref ignored
 *   - title preserved when staged is non-empty
 *   - title falls back to defaultTitle, then displayName
 *   - quantity null → "1", quantity present → "n"
 *   - unitPriceCents null → "", present → "n"
 *   - description null → "", present → exact value
 *   - payment defaults applied when null on preset
 *   - packet helper: usable packet → ok, no PUBLISHED → no_published_revision
 *   - packet helper: title preserve-if-non-empty unchanged from Phase 1
 */

const SAMPLE_PUBLISHED_REVISION_ID = "rev-published-abc";

function makePresetSummary(overrides: Partial<LineItemPresetSummaryDto> & {
  defaultTitle?: string | null;
  defaultDescription?: string | null;
  defaultQuantity?: number | null;
  defaultUnitPriceCents?: number | null;
  defaultPaymentBeforeWork?: boolean | null;
  defaultPaymentGateTitleOverride?: string | null;
}): LineItemPresetSummaryDto & {
  defaultTitle: string | null;
  defaultDescription: string | null;
  defaultQuantity: number | null;
  defaultUnitPriceCents: number | null;
  defaultPaymentBeforeWork: boolean | null;
  defaultPaymentGateTitleOverride: string | null;
} {
  return {
    id: "preset-id",
    presetKey: "test-preset",
    displayName: "Test Preset",
    defaultExecutionMode: "SOLD_SCOPE",
    defaultScopePacketId: null,
    defaultScopePacket: null,
    createdAtIso: "2026-04-25T00:00:00.000Z",
    updatedAtIso: "2026-04-25T00:00:00.000Z",
    defaultTitle: null,
    defaultDescription: null,
    defaultQuantity: null,
    defaultUnitPriceCents: null,
    defaultPaymentBeforeWork: null,
    defaultPaymentGateTitleOverride: null,
    ...overrides,
  };
}

function manifestPresetWithUsablePacket() {
  return makePresetSummary({
    id: "preset-manifest",
    presetKey: "ev-l2-install",
    displayName: "EV Charger L2 Install",
    defaultExecutionMode: "MANIFEST",
    defaultScopePacketId: "pkt-1",
    defaultScopePacket: {
      id: "pkt-1",
      packetKey: "ev-pkt",
      displayName: "EV Charger Install Packet",
      latestPublishedRevisionId: SAMPLE_PUBLISHED_REVISION_ID,
      latestPublishedRevisionNumber: 2,
    },
    defaultTitle: "Standard EV L2 Install",
    defaultDescription: "Includes panel survey + 40A circuit.",
    defaultQuantity: 1,
    defaultUnitPriceCents: 124900,
    defaultPaymentBeforeWork: true,
    defaultPaymentGateTitleOverride: "Pay before install",
  });
}

describe("buildFieldsFromPreset (MANIFEST)", () => {
  it("returns ok with packet pinned to latestPublishedRevisionId for a usable preset", () => {
    const result = buildFieldsFromPreset(manifestPresetWithUsablePacket(), undefined);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fields).toEqual<PrefilledFields>({
      title: "Standard EV L2 Install",
      description: "Includes panel survey + 40A circuit.",
      quantity: "1",
      executionMode: "MANIFEST",
      unitPriceCents: "124900",
      paymentBeforeWork: true,
      paymentGateTitleOverride: "Pay before install",
      packetSource: "library",
      scopePacketRevisionId: SAMPLE_PUBLISHED_REVISION_ID,
      quoteLocalPacketId: "",
    });
  });

  it("falls back to displayName when defaultTitle is null", () => {
    const preset = manifestPresetWithUsablePacket();
    preset.defaultTitle = null;
    const result = buildFieldsFromPreset(preset, undefined);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fields.title).toBe("EV Charger L2 Install");
  });

  it("preserves a non-empty staged title (does not overwrite user input)", () => {
    const preset = manifestPresetWithUsablePacket();
    const staged: StagedFieldsForPrefill = { title: "  My custom title  ", quantity: "" };
    const result = buildFieldsFromPreset(preset, staged);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fields.title).toBe("  My custom title  ");
  });

  it("treats whitespace-only staged title as empty (preset wins)", () => {
    const preset = manifestPresetWithUsablePacket();
    const staged: StagedFieldsForPrefill = { title: "    ", quantity: "" };
    const result = buildFieldsFromPreset(preset, staged);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fields.title).toBe("Standard EV L2 Install");
  });

  it("returns manifest_packet_missing when defaultScopePacket is null", () => {
    const preset = manifestPresetWithUsablePacket();
    preset.defaultScopePacket = null;
    const result = buildFieldsFromPreset(preset, undefined);
    expect(result).toEqual({ ok: false, reason: "manifest_packet_missing" });
  });

  it("returns manifest_no_published_revision when packet has no latestPublishedRevisionId", () => {
    const preset = manifestPresetWithUsablePacket();
    preset.defaultScopePacket = {
      id: "pkt-1",
      packetKey: "draft-only",
      displayName: "Draft-only packet",
      latestPublishedRevisionId: null,
      latestPublishedRevisionNumber: null,
    };
    const result = buildFieldsFromPreset(preset, undefined);
    expect(result).toEqual({ ok: false, reason: "manifest_no_published_revision" });
  });

  it("falls back quantity to '1' when defaultQuantity is null", () => {
    const preset = manifestPresetWithUsablePacket();
    preset.defaultQuantity = null;
    const result = buildFieldsFromPreset(preset, undefined);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fields.quantity).toBe("1");
  });

  it("preserves an explicit quantity from the preset (preset always wins for commercial fields)", () => {
    const preset = manifestPresetWithUsablePacket();
    preset.defaultQuantity = 4;
    const result = buildFieldsFromPreset(preset, { title: "", quantity: "9" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fields.quantity).toBe("4");
  });

  it("falls back unitPriceCents to '' when defaultUnitPriceCents is null", () => {
    const preset = manifestPresetWithUsablePacket();
    preset.defaultUnitPriceCents = null;
    const result = buildFieldsFromPreset(preset, undefined);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fields.unitPriceCents).toBe("");
  });

  it("falls back description to '' when defaultDescription is null", () => {
    const preset = manifestPresetWithUsablePacket();
    preset.defaultDescription = null;
    const result = buildFieldsFromPreset(preset, undefined);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fields.description).toBe("");
  });

  it("falls back payment defaults when null on preset", () => {
    const preset = manifestPresetWithUsablePacket();
    preset.defaultPaymentBeforeWork = null;
    preset.defaultPaymentGateTitleOverride = null;
    const result = buildFieldsFromPreset(preset, undefined);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fields.paymentBeforeWork).toBe(false);
    expect(result.fields.paymentGateTitleOverride).toBe("");
  });
});

describe("buildFieldsFromPreset (SOLD_SCOPE)", () => {
  it("returns ok with no packet pin and clears both packet ids", () => {
    const preset = makePresetSummary({
      id: "preset-sold",
      presetKey: "after-hours-fee",
      displayName: "After Hours Premium",
      defaultExecutionMode: "SOLD_SCOPE",
      defaultTitle: "After-hours surcharge",
      defaultDescription: "Applied to off-hours scheduling.",
      defaultQuantity: 2,
      defaultUnitPriceCents: 25000,
      defaultPaymentBeforeWork: false,
      defaultPaymentGateTitleOverride: null,
    });
    const result = buildFieldsFromPreset(preset, undefined);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fields).toEqual<PrefilledFields>({
      title: "After-hours surcharge",
      description: "Applied to off-hours scheduling.",
      quantity: "2",
      executionMode: "SOLD_SCOPE",
      unitPriceCents: "25000",
      paymentBeforeWork: false,
      paymentGateTitleOverride: "",
      packetSource: "none",
      scopePacketRevisionId: "",
      quoteLocalPacketId: "",
    });
  });

  it("ignores any packet ref on a SOLD_SCOPE preset (defensive — should not exist by invariant)", () => {
    const preset = makePresetSummary({
      defaultExecutionMode: "SOLD_SCOPE",
      defaultScopePacketId: "stale-pkt",
      defaultScopePacket: {
        id: "stale-pkt",
        packetKey: "stale",
        displayName: "Stale (should be ignored)",
        latestPublishedRevisionId: SAMPLE_PUBLISHED_REVISION_ID,
        latestPublishedRevisionNumber: 1,
      },
    });
    const result = buildFieldsFromPreset(preset, undefined);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fields.executionMode).toBe("SOLD_SCOPE");
    expect(result.fields.packetSource).toBe("none");
    expect(result.fields.scopePacketRevisionId).toBe("");
    expect(result.fields.quoteLocalPacketId).toBe("");
  });
});

describe("buildFieldsFromPacket", () => {
  it("returns no_published_revision for a packet without a published revision", () => {
    const result = buildFieldsFromPacket(
      { displayName: "Draft-only", latestPublishedRevisionId: null },
      undefined,
    );
    expect(result).toEqual({ ok: false, reason: "no_published_revision" });
  });

  it("pins MANIFEST to the latestPublishedRevisionId for a usable packet", () => {
    const result = buildFieldsFromPacket(
      { displayName: "Solar PV Install", latestPublishedRevisionId: "rev-xyz" },
      undefined,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fields).toEqual<PrefilledFields>({
      title: "Solar PV Install",
      description: "",
      quantity: "1",
      executionMode: "MANIFEST",
      unitPriceCents: "",
      paymentBeforeWork: false,
      paymentGateTitleOverride: "",
      packetSource: "library",
      scopePacketRevisionId: "rev-xyz",
      quoteLocalPacketId: "",
    });
  });

  it("preserves a non-empty staged title", () => {
    const staged: PrefilledFields = {
      title: "Custom title",
      description: "",
      quantity: "",
      executionMode: "SOLD_SCOPE",
      unitPriceCents: "",
      paymentBeforeWork: false,
      paymentGateTitleOverride: "",
      packetSource: "none",
      scopePacketRevisionId: "",
      quoteLocalPacketId: "",
    };
    const result = buildFieldsFromPacket(
      { displayName: "Library default", latestPublishedRevisionId: "rev-1" },
      staged,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fields.title).toBe("Custom title");
  });

  it("preserves any non-empty staged quantity (Phase 1 contract)", () => {
    const staged: PrefilledFields = {
      title: "",
      description: "",
      quantity: "5",
      executionMode: "SOLD_SCOPE",
      unitPriceCents: "",
      paymentBeforeWork: false,
      paymentGateTitleOverride: "",
      packetSource: "none",
      scopePacketRevisionId: "",
      quoteLocalPacketId: "",
    };
    const result = buildFieldsFromPacket(
      { displayName: "Library default", latestPublishedRevisionId: "rev-1" },
      staged,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fields.quantity).toBe("5");
  });

  it("does NOT touch description / unitPriceCents / payment fields (a packet has no commercial defaults)", () => {
    const staged: PrefilledFields = {
      title: "",
      description: "Existing description",
      quantity: "1",
      executionMode: "SOLD_SCOPE",
      unitPriceCents: "9999",
      paymentBeforeWork: true,
      paymentGateTitleOverride: "Custom gate",
      packetSource: "none",
      scopePacketRevisionId: "",
      quoteLocalPacketId: "",
    };
    const result = buildFieldsFromPacket(
      { displayName: "Library default", latestPublishedRevisionId: "rev-1" },
      staged,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fields.description).toBe("Existing description");
    expect(result.fields.unitPriceCents).toBe("9999");
    expect(result.fields.paymentBeforeWork).toBe(true);
    expect(result.fields.paymentGateTitleOverride).toBe("Custom gate");
  });
});
