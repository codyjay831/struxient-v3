import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  LINE_ITEM_PRESET_LIST_LIMIT_DEFAULTS,
  clampLineItemPresetListLimit,
  getLineItemPresetDetailForTenant,
  listLineItemPresetsForTenant,
} from "./line-item-preset-reads";

/**
 * Integration tests for the LineItemPreset read layer (Phase 2 / Slice 1).
 *
 * Mirrors the pattern in `lead-mutations-and-convert.integration.test.ts`:
 *   - DB-backed via real PrismaClient
 *   - skipped when `DATABASE_URL` is unset
 *   - creates two ephemeral tenants, seeds presets directly via Prisma,
 *     and tears down with deleteMany scoped to those tenant ids only
 *
 * All Prisma writes here go through `prisma.lineItemPreset.create({ data })`
 * directly. There is no preset mutation API yet (that's Slice 3); this is
 * the only authoring path that exists, and we are deliberately testing the
 * READ surface, not enforcing the mode/packet correlation invariant (also
 * a future slice).
 */

const prisma = new PrismaClient();
const run = Boolean(process.env.DATABASE_URL?.trim());

describe.skipIf(!run)("clampLineItemPresetListLimit (pure)", () => {
  it("returns DEFAULT for null / empty / non-numeric / negative", () => {
    expect(clampLineItemPresetListLimit(null)).toBe(LINE_ITEM_PRESET_LIST_LIMIT_DEFAULTS.default);
    expect(clampLineItemPresetListLimit("")).toBe(LINE_ITEM_PRESET_LIST_LIMIT_DEFAULTS.default);
    expect(clampLineItemPresetListLimit("nope")).toBe(LINE_ITEM_PRESET_LIST_LIMIT_DEFAULTS.default);
    expect(clampLineItemPresetListLimit("0")).toBe(LINE_ITEM_PRESET_LIST_LIMIT_DEFAULTS.default);
    expect(clampLineItemPresetListLimit("-7")).toBe(LINE_ITEM_PRESET_LIST_LIMIT_DEFAULTS.default);
  });

  it("passes through valid values up to MAX, then clamps", () => {
    expect(clampLineItemPresetListLimit("1")).toBe(1);
    expect(clampLineItemPresetListLimit("25")).toBe(25);
    expect(clampLineItemPresetListLimit(String(LINE_ITEM_PRESET_LIST_LIMIT_DEFAULTS.max))).toBe(
      LINE_ITEM_PRESET_LIST_LIMIT_DEFAULTS.max,
    );
    expect(clampLineItemPresetListLimit(String(LINE_ITEM_PRESET_LIST_LIMIT_DEFAULTS.max + 50))).toBe(
      LINE_ITEM_PRESET_LIST_LIMIT_DEFAULTS.max,
    );
  });
});

describe.skipIf(!run)("LineItemPreset reads (integration)", () => {
  let tenantId: string;
  let otherTenantId: string;
  let manifestPacketId: string;
  let otherTenantPacketId: string;
  let createdPresetIds: string[] = [];

  beforeAll(async () => {
    const t = await prisma.tenant.create({
      data: { name: "LineItemPresetReadsTenant", autoActivateOnSign: false },
    });
    tenantId = t.id;

    const t2 = await prisma.tenant.create({
      data: { name: "LineItemPresetReadsOtherTenant", autoActivateOnSign: false },
    });
    otherTenantId = t2.id;

    const packet = await prisma.scopePacket.create({
      data: {
        tenantId,
        packetKey: `lipt-pkt-${tenantId.slice(0, 6)}`,
        displayName: "EV Charger Install Packet",
      },
    });
    manifestPacketId = packet.id;

    const otherPacket = await prisma.scopePacket.create({
      data: {
        tenantId: otherTenantId,
        packetKey: `lipt-other-${otherTenantId.slice(0, 6)}`,
        displayName: "Other Tenant Packet",
      },
    });
    otherTenantPacketId = otherPacket.id;
  });

  afterAll(async () => {
    if (createdPresetIds.length > 0) {
      await prisma.lineItemPreset.deleteMany({ where: { id: { in: createdPresetIds } } });
    }
    if (tenantId) {
      await prisma.lineItemPreset.deleteMany({ where: { tenantId } });
      await prisma.scopePacketRevision.deleteMany({ where: { scopePacket: { tenantId } } });
      await prisma.scopePacket.deleteMany({ where: { tenantId } });
      await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {});
    }
    if (otherTenantId) {
      await prisma.lineItemPreset.deleteMany({ where: { tenantId: otherTenantId } });
      await prisma.scopePacketRevision.deleteMany({ where: { scopePacket: { tenantId: otherTenantId } } });
      await prisma.scopePacket.deleteMany({ where: { tenantId: otherTenantId } });
      await prisma.tenant.delete({ where: { id: otherTenantId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  async function createPreset(data: {
    tenantId: string;
    presetKey?: string | null;
    displayName: string;
    defaultExecutionMode: "SOLD_SCOPE" | "MANIFEST";
    defaultScopePacketId?: string | null;
    defaultUnitPriceCents?: number | null;
    defaultDescription?: string | null;
  }) {
    const created = await prisma.lineItemPreset.create({
      data: {
        tenantId: data.tenantId,
        presetKey: data.presetKey ?? null,
        displayName: data.displayName,
        defaultExecutionMode: data.defaultExecutionMode,
        defaultScopePacketId: data.defaultScopePacketId ?? null,
        defaultUnitPriceCents: data.defaultUnitPriceCents ?? null,
        defaultDescription: data.defaultDescription ?? null,
      },
    });
    createdPresetIds.push(created.id);
    return created;
  }

  it("returns [] for an empty tenant", async () => {
    const items = await listLineItemPresetsForTenant(prisma, { tenantId, limit: 10 });
    expect(items).toEqual([]);
  });

  it("hydrates the packet ref for MANIFEST presets and leaves it null for SOLD_SCOPE", async () => {
    await createPreset({
      tenantId,
      presetKey: "ev-l2-install",
      displayName: "EV L2 Install (manifest)",
      defaultExecutionMode: "MANIFEST",
      defaultScopePacketId: manifestPacketId,
      defaultUnitPriceCents: 124900,
      defaultDescription: "Standard 40A install w/ panel survey.",
    });
    await createPreset({
      tenantId,
      presetKey: "after-hours-fee",
      displayName: "After Hours Premium (sold scope)",
      defaultExecutionMode: "SOLD_SCOPE",
      defaultUnitPriceCents: 25000,
    });

    const items = await listLineItemPresetsForTenant(prisma, { tenantId, limit: 50 });
    expect(items).toHaveLength(2);

    const manifestItem = items.find((i) => i.presetKey === "ev-l2-install");
    expect(manifestItem).toBeDefined();
    expect(manifestItem?.defaultExecutionMode).toBe("MANIFEST");
    expect(manifestItem?.defaultScopePacketId).toBe(manifestPacketId);
    expect(manifestItem?.defaultScopePacket).toEqual({
      id: manifestPacketId,
      packetKey: expect.stringMatching(/^lipt-pkt-/),
      displayName: "EV Charger Install Packet",
      latestPublishedRevisionId: null,
      latestPublishedRevisionNumber: null,
    });

    const soldItem = items.find((i) => i.presetKey === "after-hours-fee");
    expect(soldItem).toBeDefined();
    expect(soldItem?.defaultExecutionMode).toBe("SOLD_SCOPE");
    expect(soldItem?.defaultScopePacketId).toBeNull();
    expect(soldItem?.defaultScopePacket).toBeNull();
  });

  it("orders by displayName ascending", async () => {
    await createPreset({
      tenantId,
      presetKey: "z-last",
      displayName: "Zebra Item",
      defaultExecutionMode: "SOLD_SCOPE",
    });
    await createPreset({
      tenantId,
      presetKey: "a-first",
      displayName: "Aardvark Item",
      defaultExecutionMode: "SOLD_SCOPE",
    });

    const items = await listLineItemPresetsForTenant(prisma, { tenantId, limit: 50 });
    const names = items.map((i) => i.displayName);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sorted);
  });

  it("respects the limit parameter", async () => {
    const all = await listLineItemPresetsForTenant(prisma, { tenantId, limit: 50 });
    expect(all.length).toBeGreaterThan(2);

    const limited = await listLineItemPresetsForTenant(prisma, { tenantId, limit: 2 });
    expect(limited).toHaveLength(2);
    expect(limited.map((i) => i.id)).toEqual(all.slice(0, 2).map((i) => i.id));
  });

  it("filters by case-insensitive search across displayName and presetKey", async () => {
    const byDisplayName = await listLineItemPresetsForTenant(prisma, {
      tenantId,
      limit: 50,
      search: "ZEBRA",
    });
    expect(byDisplayName.map((i) => i.presetKey)).toContain("z-last");
    expect(byDisplayName.every((i) => i.displayName.toLowerCase().includes("zebra"))).toBe(true);

    const byPresetKey = await listLineItemPresetsForTenant(prisma, {
      tenantId,
      limit: 50,
      search: "ev-l2",
    });
    expect(byPresetKey.map((i) => i.presetKey)).toContain("ev-l2-install");

    const noMatch = await listLineItemPresetsForTenant(prisma, {
      tenantId,
      limit: 50,
      search: "no-such-thing-xyz",
    });
    expect(noMatch).toEqual([]);
  });

  it("treats whitespace-only search as no filter", async () => {
    const noFilter = await listLineItemPresetsForTenant(prisma, {
      tenantId,
      limit: 50,
      search: "   ",
    });
    const baseline = await listLineItemPresetsForTenant(prisma, { tenantId, limit: 50 });
    expect(noFilter.map((i) => i.id)).toEqual(baseline.map((i) => i.id));
  });

  it("isolates tenants — neither tenant sees the other's presets", async () => {
    await createPreset({
      tenantId: otherTenantId,
      presetKey: "other-only",
      displayName: "Should Not Cross Tenants",
      defaultExecutionMode: "MANIFEST",
      defaultScopePacketId: otherTenantPacketId,
    });

    const tenantOneItems = await listLineItemPresetsForTenant(prisma, { tenantId, limit: 200 });
    expect(tenantOneItems.find((i) => i.presetKey === "other-only")).toBeUndefined();

    const tenantTwoItems = await listLineItemPresetsForTenant(prisma, { tenantId: otherTenantId, limit: 200 });
    expect(tenantTwoItems.map((i) => i.presetKey)).toEqual(["other-only"]);
  });

  it("getDetail returns full commercial defaults for the owning tenant", async () => {
    const presetWithDefaults = await createPreset({
      tenantId,
      presetKey: "detail-target",
      displayName: "Detail Target",
      defaultExecutionMode: "MANIFEST",
      defaultScopePacketId: manifestPacketId,
      defaultUnitPriceCents: 999900,
      defaultDescription: "Full description payload for the detail read.",
    });

    const detail = await getLineItemPresetDetailForTenant(prisma, {
      tenantId,
      presetId: presetWithDefaults.id,
    });
    expect(detail).not.toBeNull();
    expect(detail?.id).toBe(presetWithDefaults.id);
    expect(detail?.defaultUnitPriceCents).toBe(999900);
    expect(detail?.defaultDescription).toBe("Full description payload for the detail read.");
    expect(detail?.defaultScopePacket?.id).toBe(manifestPacketId);
  });

  it("getDetail returns null when called with another tenant's preset id (cross-tenant probe)", async () => {
    const otherPreset = await createPreset({
      tenantId: otherTenantId,
      presetKey: "cross-tenant-probe",
      displayName: "Cross-Tenant Probe",
      defaultExecutionMode: "SOLD_SCOPE",
    });

    const probeAsTenantOne = await getLineItemPresetDetailForTenant(prisma, {
      tenantId,
      presetId: otherPreset.id,
    });
    expect(probeAsTenantOne).toBeNull();

    const probeAsTenantTwo = await getLineItemPresetDetailForTenant(prisma, {
      tenantId: otherTenantId,
      presetId: otherPreset.id,
    });
    expect(probeAsTenantTwo).not.toBeNull();
  });

  it("getDetail returns null for a missing id", async () => {
    const detail = await getLineItemPresetDetailForTenant(prisma, {
      tenantId,
      presetId: "does-not-exist-id",
    });
    expect(detail).toBeNull();
  });

  it("hydrates latestPublishedRevisionId/Number from the parent packet's PUBLISHED revisions (Slice 2 picker gate)", async () => {
    const packet = await prisma.scopePacket.create({
      data: {
        tenantId,
        packetKey: `lipt-pub-${Date.now()}`,
        displayName: "Packet With Published Revisions",
      },
    });
    await prisma.scopePacketRevision.create({
      data: {
        scopePacketId: packet.id,
        revisionNumber: 1,
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });
    const revB = await prisma.scopePacketRevision.create({
      data: {
        scopePacketId: packet.id,
        revisionNumber: 2,
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });
    await prisma.scopePacketRevision.create({
      data: {
        scopePacketId: packet.id,
        revisionNumber: 3,
        status: "DRAFT",
      },
    });

    const preset = await createPreset({
      tenantId,
      presetKey: "preset-with-published",
      displayName: "Preset With Published Packet",
      defaultExecutionMode: "MANIFEST",
      defaultScopePacketId: packet.id,
    });

    const items = await listLineItemPresetsForTenant(prisma, { tenantId, limit: 200 });
    const hit = items.find((i) => i.id === preset.id);
    expect(hit?.defaultScopePacket?.latestPublishedRevisionId).toBe(revB.id);
    expect(hit?.defaultScopePacket?.latestPublishedRevisionNumber).toBe(2);
  });

  it("leaves latestPublishedRevisionId null when the parent packet has only DRAFT revisions (preset is unusable for MANIFEST)", async () => {
    const draftOnlyPacket = await prisma.scopePacket.create({
      data: {
        tenantId,
        packetKey: `lipt-drft-${Date.now()}`,
        displayName: "Packet With Only Draft",
      },
    });
    await prisma.scopePacketRevision.create({
      data: {
        scopePacketId: draftOnlyPacket.id,
        revisionNumber: 1,
        status: "DRAFT",
      },
    });

    const preset = await createPreset({
      tenantId,
      presetKey: "preset-with-draft-only",
      displayName: "Preset With Draft-Only Packet",
      defaultExecutionMode: "MANIFEST",
      defaultScopePacketId: draftOnlyPacket.id,
    });

    const items = await listLineItemPresetsForTenant(prisma, { tenantId, limit: 200 });
    const hit = items.find((i) => i.id === preset.id);
    expect(hit?.defaultScopePacket?.id).toBe(draftOnlyPacket.id);
    expect(hit?.defaultScopePacket?.latestPublishedRevisionId).toBeNull();
    expect(hit?.defaultScopePacket?.latestPublishedRevisionNumber).toBeNull();
  });

  it("packet ref becomes null when underlying ScopePacket is deleted (SetNull FK)", async () => {
    const tempPacket = await prisma.scopePacket.create({
      data: {
        tenantId,
        packetKey: `lipt-temp-${Date.now()}`,
        displayName: "Temporary packet (will be deleted)",
      },
    });
    const preset = await createPreset({
      tenantId,
      presetKey: "preset-with-doomed-packet",
      displayName: "Preset With Doomed Packet",
      defaultExecutionMode: "MANIFEST",
      defaultScopePacketId: tempPacket.id,
    });

    await prisma.scopePacket.delete({ where: { id: tempPacket.id } });

    const detail = await getLineItemPresetDetailForTenant(prisma, {
      tenantId,
      presetId: preset.id,
    });
    expect(detail).not.toBeNull();
    expect(detail?.defaultScopePacketId).toBeNull();
    expect(detail?.defaultScopePacket).toBeNull();
    expect(detail?.defaultExecutionMode).toBe("MANIFEST");
  });
});
