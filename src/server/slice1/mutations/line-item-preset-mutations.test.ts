import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { InvariantViolationError } from "../errors";
import {
  createLineItemPresetForTenant,
  deleteLineItemPresetForTenant,
  updateLineItemPresetForTenant,
} from "./line-item-preset-mutations";
import { getLineItemPresetDetailForTenant } from "../reads/line-item-preset-reads";

/**
 * Integration tests for the LineItemPreset write surface (Phase 2 / Slice 3).
 *
 * Mirrors the bootstrap pattern in `line-item-preset-reads.test.ts`:
 *   - DB-backed via real PrismaClient
 *   - skipped when `DATABASE_URL` is unset
 *   - creates two ephemeral tenants + per-tenant ScopePackets
 *   - tears down with deleteMany scoped to those tenant ids only
 *
 * Coverage matrix:
 *   - create: MANIFEST/SOLD_SCOPE happy paths + every per-field invariant
 *   - update: partial patches, mode flips (both directions), tenant isolation
 *   - delete: success, cross-tenant miss, packet untouched
 *   - presetKey uniqueness: same tenant collides, different tenants do not
 */

const prisma = new PrismaClient();
const run = Boolean(process.env.DATABASE_URL?.trim());

const FAKE_USER_ID = "user-fixture";

async function expectInvariant<T>(
  fn: () => Promise<T>,
  code: string,
): Promise<InvariantViolationError> {
  try {
    await fn();
  } catch (e) {
    expect(e).toBeInstanceOf(InvariantViolationError);
    if (e instanceof InvariantViolationError) {
      expect(e.code).toBe(code);
      return e;
    }
  }
  throw new Error(`expected InvariantViolationError(${code}) but no error was thrown`);
}

describe.skipIf(!run)("LineItemPreset write surface (integration)", () => {
  let tenantId: string;
  let otherTenantId: string;
  let manifestPacketId: string;
  let secondManifestPacketId: string;
  let otherTenantPacketId: string;

  beforeAll(async () => {
    const t = await prisma.tenant.create({
      data: { name: "LineItemPresetWriteTenant", autoActivateOnSign: false },
    });
    tenantId = t.id;

    const t2 = await prisma.tenant.create({
      data: { name: "LineItemPresetWriteOtherTenant", autoActivateOnSign: false },
    });
    otherTenantId = t2.id;

    const packet = await prisma.scopePacket.create({
      data: {
        tenantId,
        packetKey: `lipw-pkt-${tenantId.slice(0, 6)}`,
        displayName: "EV Charger Install Packet",
      },
    });
    manifestPacketId = packet.id;

    const packet2 = await prisma.scopePacket.create({
      data: {
        tenantId,
        packetKey: `lipw-pkt2-${tenantId.slice(0, 6)}`,
        displayName: "Chimney Flashing Repair Packet",
      },
    });
    secondManifestPacketId = packet2.id;

    const otherPacket = await prisma.scopePacket.create({
      data: {
        tenantId: otherTenantId,
        packetKey: `lipw-other-${otherTenantId.slice(0, 6)}`,
        displayName: "Other Tenant Packet",
      },
    });
    otherTenantPacketId = otherPacket.id;
  });

  afterAll(async () => {
    if (tenantId) {
      await prisma.lineItemPreset.deleteMany({ where: { tenantId } });
      await prisma.scopePacketRevision.deleteMany({ where: { scopePacket: { tenantId } } });
      await prisma.scopePacket.deleteMany({ where: { tenantId } });
      await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {});
    }
    if (otherTenantId) {
      await prisma.lineItemPreset.deleteMany({ where: { tenantId: otherTenantId } });
      await prisma.scopePacketRevision.deleteMany({
        where: { scopePacket: { tenantId: otherTenantId } },
      });
      await prisma.scopePacket.deleteMany({ where: { tenantId: otherTenantId } });
      await prisma.tenant.delete({ where: { id: otherTenantId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  /* ────────────────────────────── create ────────────────────────────── */

  describe("createLineItemPresetForTenant", () => {
    it("creates a MANIFEST preset with a tenant-owned packet and round-trips the DTO", async () => {
      const dto = await createLineItemPresetForTenant(prisma, {
        tenantId,
        userId: FAKE_USER_ID,
        displayName: "EV Charger Install (saved)",
        presetKey: "ev-charger-install",
        defaultTitle: "EV Charger Install",
        defaultDescription: "Level 2 charger, 240V branch circuit, panel work as needed.",
        defaultExecutionMode: "MANIFEST",
        defaultScopePacketId: manifestPacketId,
        defaultQuantity: 1,
        defaultUnitPriceCents: 125000,
        defaultPaymentBeforeWork: false,
        defaultPaymentGateTitleOverride: null,
      });

      expect(dto.id).toMatch(/.+/);
      expect(dto.displayName).toBe("EV Charger Install (saved)");
      expect(dto.presetKey).toBe("ev-charger-install");
      expect(dto.defaultTitle).toBe("EV Charger Install");
      expect(dto.defaultDescription).toMatch(/^Level 2 charger/);
      expect(dto.defaultExecutionMode).toBe("MANIFEST");
      expect(dto.defaultScopePacketId).toBe(manifestPacketId);
      expect(dto.defaultQuantity).toBe(1);
      expect(dto.defaultUnitPriceCents).toBe(125000);
      expect(dto.defaultPaymentBeforeWork).toBe(false);
      expect(dto.defaultPaymentGateTitleOverride).toBeNull();
      expect(dto.defaultScopePacket).toEqual({
        id: manifestPacketId,
        packetKey: expect.stringMatching(/^lipw-pkt-/),
        displayName: "EV Charger Install Packet",
        latestPublishedRevisionId: null,
        latestPublishedRevisionNumber: null,
      });

      // Round-trips through the read mapper exactly.
      const reread = await getLineItemPresetDetailForTenant(prisma, {
        tenantId,
        presetId: dto.id,
      });
      expect(reread).toEqual(dto);
    });

    it("creates a SOLD_SCOPE preset with no packet and minimal commercial defaults", async () => {
      const dto = await createLineItemPresetForTenant(prisma, {
        tenantId,
        userId: FAKE_USER_ID,
        displayName: "After-hours surcharge",
        defaultExecutionMode: "SOLD_SCOPE",
      });

      expect(dto.defaultExecutionMode).toBe("SOLD_SCOPE");
      expect(dto.defaultScopePacketId).toBeNull();
      expect(dto.defaultScopePacket).toBeNull();
      expect(dto.defaultTitle).toBeNull();
      expect(dto.defaultDescription).toBeNull();
      expect(dto.defaultQuantity).toBeNull();
      expect(dto.defaultUnitPriceCents).toBeNull();
      expect(dto.defaultPaymentBeforeWork).toBeNull();
      expect(dto.defaultPaymentGateTitleOverride).toBeNull();
      expect(dto.presetKey).toBeNull();
    });

    it("normalizes empty/whitespace presetKey to null (no unique blowup)", async () => {
      const a = await createLineItemPresetForTenant(prisma, {
        tenantId,
        userId: FAKE_USER_ID,
        displayName: "Empty key A",
        presetKey: "",
        defaultExecutionMode: "SOLD_SCOPE",
      });
      const b = await createLineItemPresetForTenant(prisma, {
        tenantId,
        userId: FAKE_USER_ID,
        displayName: "Empty key B",
        presetKey: "   ",
        defaultExecutionMode: "SOLD_SCOPE",
      });
      expect(a.presetKey).toBeNull();
      expect(b.presetKey).toBeNull();
    });

    it("rejects MANIFEST without a packet", async () => {
      await expectInvariant(
        () =>
          createLineItemPresetForTenant(prisma, {
            tenantId,
            userId: FAKE_USER_ID,
            displayName: "Missing packet preset",
            defaultExecutionMode: "MANIFEST",
          }),
        "LINE_ITEM_PRESET_MANIFEST_REQUIRES_PACKET",
      );
    });

    it("rejects SOLD_SCOPE with a packet", async () => {
      await expectInvariant(
        () =>
          createLineItemPresetForTenant(prisma, {
            tenantId,
            userId: FAKE_USER_ID,
            displayName: "Forbidden sold-scope packet",
            defaultExecutionMode: "SOLD_SCOPE",
            defaultScopePacketId: manifestPacketId,
          }),
        "LINE_ITEM_PRESET_SOLD_SCOPE_FORBIDS_PACKET",
      );
    });

    it("rejects a packet that belongs to another tenant", async () => {
      await expectInvariant(
        () =>
          createLineItemPresetForTenant(prisma, {
            tenantId,
            userId: FAKE_USER_ID,
            displayName: "Cross-tenant packet attempt",
            defaultExecutionMode: "MANIFEST",
            defaultScopePacketId: otherTenantPacketId,
          }),
        "LINE_ITEM_PRESET_PACKET_TENANT_MISMATCH",
      );
    });

    it("rejects an unknown packet id (treated as cross-tenant; no info leak)", async () => {
      await expectInvariant(
        () =>
          createLineItemPresetForTenant(prisma, {
            tenantId,
            userId: FAKE_USER_ID,
            displayName: "Bogus packet id",
            defaultExecutionMode: "MANIFEST",
            defaultScopePacketId: "no-such-packet-id",
          }),
        "LINE_ITEM_PRESET_PACKET_TENANT_MISMATCH",
      );
    });

    it("rejects empty / oversize displayName", async () => {
      await expectInvariant(
        () =>
          createLineItemPresetForTenant(prisma, {
            tenantId,
            userId: FAKE_USER_ID,
            displayName: "   ",
            defaultExecutionMode: "SOLD_SCOPE",
          }),
        "LINE_ITEM_PRESET_DISPLAY_NAME_INVALID",
      );
      await expectInvariant(
        () =>
          createLineItemPresetForTenant(prisma, {
            tenantId,
            userId: FAKE_USER_ID,
            displayName: "x".repeat(201),
            defaultExecutionMode: "SOLD_SCOPE",
          }),
        "LINE_ITEM_PRESET_DISPLAY_NAME_INVALID",
      );
    });

    it("rejects oversize / non-conforming presetKey", async () => {
      await expectInvariant(
        () =>
          createLineItemPresetForTenant(prisma, {
            tenantId,
            userId: FAKE_USER_ID,
            displayName: "Oversize key",
            presetKey: "x".repeat(81),
            defaultExecutionMode: "SOLD_SCOPE",
          }),
        "LINE_ITEM_PRESET_KEY_INVALID",
      );
      await expectInvariant(
        () =>
          createLineItemPresetForTenant(prisma, {
            tenantId,
            userId: FAKE_USER_ID,
            displayName: "Bad key chars",
            presetKey: "INVALID!key",
            defaultExecutionMode: "SOLD_SCOPE",
          }),
        "LINE_ITEM_PRESET_KEY_INVALID",
      );
    });

    it("rejects defaultQuantity = 0 / negative / fractional", async () => {
      for (const bad of [0, -3, 1.5]) {
        await expectInvariant(
          () =>
            createLineItemPresetForTenant(prisma, {
              tenantId,
              userId: FAKE_USER_ID,
              displayName: `Bad qty ${bad}`,
              defaultExecutionMode: "SOLD_SCOPE",
              defaultQuantity: bad,
            }),
          "LINE_ITEM_PRESET_QUANTITY_INVALID",
        );
      }
    });

    it("rejects defaultUnitPriceCents that is negative or fractional", async () => {
      for (const bad of [-1, 0.5]) {
        await expectInvariant(
          () =>
            createLineItemPresetForTenant(prisma, {
              tenantId,
              userId: FAKE_USER_ID,
              displayName: `Bad price ${bad}`,
              defaultExecutionMode: "SOLD_SCOPE",
              defaultUnitPriceCents: bad,
            }),
          "LINE_ITEM_PRESET_PRICE_INVALID",
        );
      }
    });

    it("rejects oversize defaultDescription (>4000)", async () => {
      await expectInvariant(
        () =>
          createLineItemPresetForTenant(prisma, {
            tenantId,
            userId: FAKE_USER_ID,
            displayName: "Oversize description",
            defaultExecutionMode: "SOLD_SCOPE",
            defaultDescription: "x".repeat(4001),
          }),
        "LINE_ITEM_PRESET_DESCRIPTION_INVALID",
      );
    });

    it("rejects oversize defaultPaymentGateTitleOverride (>120)", async () => {
      await expectInvariant(
        () =>
          createLineItemPresetForTenant(prisma, {
            tenantId,
            userId: FAKE_USER_ID,
            displayName: "Oversize gate title",
            defaultExecutionMode: "SOLD_SCOPE",
            defaultPaymentBeforeWork: true,
            defaultPaymentGateTitleOverride: "x".repeat(121),
          }),
        "LINE_ITEM_PRESET_GATE_TITLE_TOO_LONG",
      );
    });

    it("rejects duplicate (tenantId, presetKey) on the same tenant", async () => {
      await createLineItemPresetForTenant(prisma, {
        tenantId,
        userId: FAKE_USER_ID,
        displayName: "First with key",
        presetKey: "duplicate-key-test",
        defaultExecutionMode: "SOLD_SCOPE",
      });
      await expectInvariant(
        () =>
          createLineItemPresetForTenant(prisma, {
            tenantId,
            userId: FAKE_USER_ID,
            displayName: "Second with same key",
            presetKey: "duplicate-key-test",
            defaultExecutionMode: "SOLD_SCOPE",
          }),
        "LINE_ITEM_PRESET_KEY_TAKEN",
      );
    });

    it("allows the same presetKey across different tenants", async () => {
      const sharedKey = `shared-key-${Date.now()}`;
      const a = await createLineItemPresetForTenant(prisma, {
        tenantId,
        userId: FAKE_USER_ID,
        displayName: "Tenant A copy",
        presetKey: sharedKey,
        defaultExecutionMode: "SOLD_SCOPE",
      });
      const b = await createLineItemPresetForTenant(prisma, {
        tenantId: otherTenantId,
        userId: FAKE_USER_ID,
        displayName: "Tenant B copy",
        presetKey: sharedKey,
        defaultExecutionMode: "SOLD_SCOPE",
      });
      expect(a.presetKey).toBe(sharedKey);
      expect(b.presetKey).toBe(sharedKey);
      expect(a.id).not.toBe(b.id);
    });
  });

  /* ────────────────────────────── update ────────────────────────────── */

  describe("updateLineItemPresetForTenant", () => {
    it("touches only the columns that are present (partial patch)", async () => {
      const created = await createLineItemPresetForTenant(prisma, {
        tenantId,
        userId: FAKE_USER_ID,
        displayName: "Patchable preset",
        defaultExecutionMode: "MANIFEST",
        defaultScopePacketId: manifestPacketId,
        defaultUnitPriceCents: 50000,
        defaultDescription: "first",
      });
      const patched = await updateLineItemPresetForTenant(prisma, {
        tenantId,
        userId: FAKE_USER_ID,
        lineItemPresetId: created.id,
        defaultUnitPriceCents: 60000,
      });
      if (patched === "not_found") throw new Error("expected DTO");
      expect(patched.defaultUnitPriceCents).toBe(60000);
      // Untouched columns survive.
      expect(patched.defaultDescription).toBe("first");
      expect(patched.defaultExecutionMode).toBe("MANIFEST");
      expect(patched.defaultScopePacketId).toBe(manifestPacketId);
    });

    it("clears nullable columns when caller sends explicit null", async () => {
      const created = await createLineItemPresetForTenant(prisma, {
        tenantId,
        userId: FAKE_USER_ID,
        displayName: "Clearable preset",
        defaultExecutionMode: "SOLD_SCOPE",
        defaultDescription: "to be cleared",
        defaultQuantity: 5,
      });
      const patched = await updateLineItemPresetForTenant(prisma, {
        tenantId,
        userId: FAKE_USER_ID,
        lineItemPresetId: created.id,
        defaultDescription: null,
        defaultQuantity: null,
      });
      if (patched === "not_found") throw new Error("expected DTO");
      expect(patched.defaultDescription).toBeNull();
      expect(patched.defaultQuantity).toBeNull();
    });

    it("flips MANIFEST → SOLD_SCOPE when packet is also nulled", async () => {
      const created = await createLineItemPresetForTenant(prisma, {
        tenantId,
        userId: FAKE_USER_ID,
        displayName: "Mode flip M→S ok",
        defaultExecutionMode: "MANIFEST",
        defaultScopePacketId: manifestPacketId,
      });
      const patched = await updateLineItemPresetForTenant(prisma, {
        tenantId,
        userId: FAKE_USER_ID,
        lineItemPresetId: created.id,
        defaultExecutionMode: "SOLD_SCOPE",
        defaultScopePacketId: null,
      });
      if (patched === "not_found") throw new Error("expected DTO");
      expect(patched.defaultExecutionMode).toBe("SOLD_SCOPE");
      expect(patched.defaultScopePacketId).toBeNull();
      expect(patched.defaultScopePacket).toBeNull();
    });

    it("rejects MANIFEST → SOLD_SCOPE that leaves the packet attached", async () => {
      const created = await createLineItemPresetForTenant(prisma, {
        tenantId,
        userId: FAKE_USER_ID,
        displayName: "Mode flip M→S forgot packet",
        defaultExecutionMode: "MANIFEST",
        defaultScopePacketId: manifestPacketId,
      });
      await expectInvariant(
        () =>
          updateLineItemPresetForTenant(prisma, {
            tenantId,
            userId: FAKE_USER_ID,
            lineItemPresetId: created.id,
            defaultExecutionMode: "SOLD_SCOPE",
            // packet not cleared
          }),
        "LINE_ITEM_PRESET_SOLD_SCOPE_FORBIDS_PACKET",
      );
    });

    it("rejects SOLD_SCOPE → MANIFEST without a packet", async () => {
      const created = await createLineItemPresetForTenant(prisma, {
        tenantId,
        userId: FAKE_USER_ID,
        displayName: "Mode flip S→M missing packet",
        defaultExecutionMode: "SOLD_SCOPE",
      });
      await expectInvariant(
        () =>
          updateLineItemPresetForTenant(prisma, {
            tenantId,
            userId: FAKE_USER_ID,
            lineItemPresetId: created.id,
            defaultExecutionMode: "MANIFEST",
          }),
        "LINE_ITEM_PRESET_MANIFEST_REQUIRES_PACKET",
      );
    });

    it("flips SOLD_SCOPE → MANIFEST when a tenant-owned packet is supplied", async () => {
      const created = await createLineItemPresetForTenant(prisma, {
        tenantId,
        userId: FAKE_USER_ID,
        displayName: "Mode flip S→M ok",
        defaultExecutionMode: "SOLD_SCOPE",
      });
      const patched = await updateLineItemPresetForTenant(prisma, {
        tenantId,
        userId: FAKE_USER_ID,
        lineItemPresetId: created.id,
        defaultExecutionMode: "MANIFEST",
        defaultScopePacketId: secondManifestPacketId,
      });
      if (patched === "not_found") throw new Error("expected DTO");
      expect(patched.defaultExecutionMode).toBe("MANIFEST");
      expect(patched.defaultScopePacketId).toBe(secondManifestPacketId);
    });

    it("rejects re-pointing MANIFEST at a cross-tenant packet", async () => {
      const created = await createLineItemPresetForTenant(prisma, {
        tenantId,
        userId: FAKE_USER_ID,
        displayName: "Cross-tenant repoint",
        defaultExecutionMode: "MANIFEST",
        defaultScopePacketId: manifestPacketId,
      });
      await expectInvariant(
        () =>
          updateLineItemPresetForTenant(prisma, {
            tenantId,
            userId: FAKE_USER_ID,
            lineItemPresetId: created.id,
            defaultScopePacketId: otherTenantPacketId,
          }),
        "LINE_ITEM_PRESET_PACKET_TENANT_MISMATCH",
      );
    });

    it("returns 'not_found' when updating a preset from a different tenant", async () => {
      const owned = await createLineItemPresetForTenant(prisma, {
        tenantId,
        userId: FAKE_USER_ID,
        displayName: "Owned-by-tenantId preset",
        defaultExecutionMode: "SOLD_SCOPE",
      });
      const result = await updateLineItemPresetForTenant(prisma, {
        tenantId: otherTenantId,
        userId: FAKE_USER_ID,
        lineItemPresetId: owned.id,
        displayName: "Should not work",
      });
      expect(result).toBe("not_found");

      // Confirm the row was not mutated.
      const reread = await getLineItemPresetDetailForTenant(prisma, {
        tenantId,
        presetId: owned.id,
      });
      expect(reread?.displayName).toBe("Owned-by-tenantId preset");
    });

    it("rejects duplicate presetKey on update (same tenant)", async () => {
      const a = await createLineItemPresetForTenant(prisma, {
        tenantId,
        userId: FAKE_USER_ID,
        displayName: "Holder of key alpha",
        presetKey: "alpha-key",
        defaultExecutionMode: "SOLD_SCOPE",
      });
      const b = await createLineItemPresetForTenant(prisma, {
        tenantId,
        userId: FAKE_USER_ID,
        displayName: "Wants alpha key",
        defaultExecutionMode: "SOLD_SCOPE",
      });
      await expectInvariant(
        () =>
          updateLineItemPresetForTenant(prisma, {
            tenantId,
            userId: FAKE_USER_ID,
            lineItemPresetId: b.id,
            presetKey: "alpha-key",
          }),
        "LINE_ITEM_PRESET_KEY_TAKEN",
      );
      // Cleanup-friendly: keep `a` referenced so lint doesn't complain.
      expect(a.id).not.toBe(b.id);
    });
  });

  /* ────────────────────────────── delete ────────────────────────────── */

  describe("deleteLineItemPresetForTenant", () => {
    it("removes the preset from the tenant", async () => {
      const created = await createLineItemPresetForTenant(prisma, {
        tenantId,
        userId: FAKE_USER_ID,
        displayName: "Deletable preset",
        defaultExecutionMode: "SOLD_SCOPE",
      });
      const deleted = await deleteLineItemPresetForTenant(prisma, {
        tenantId,
        userId: FAKE_USER_ID,
        lineItemPresetId: created.id,
      });
      expect(deleted).toEqual({ deleted: true });

      const after = await getLineItemPresetDetailForTenant(prisma, {
        tenantId,
        presetId: created.id,
      });
      expect(after).toBeNull();
    });

    it("returns 'not_found' for cross-tenant delete and leaves the row intact", async () => {
      const created = await createLineItemPresetForTenant(prisma, {
        tenantId,
        userId: FAKE_USER_ID,
        displayName: "Survives cross-tenant delete",
        defaultExecutionMode: "SOLD_SCOPE",
      });
      const result = await deleteLineItemPresetForTenant(prisma, {
        tenantId: otherTenantId,
        userId: FAKE_USER_ID,
        lineItemPresetId: created.id,
      });
      expect(result).toBe("not_found");

      const reread = await getLineItemPresetDetailForTenant(prisma, {
        tenantId,
        presetId: created.id,
      });
      expect(reread?.id).toBe(created.id);
    });

    it("does not delete the linked ScopePacket when the preset is removed", async () => {
      const created = await createLineItemPresetForTenant(prisma, {
        tenantId,
        userId: FAKE_USER_ID,
        displayName: "Manifest preset to be deleted",
        defaultExecutionMode: "MANIFEST",
        defaultScopePacketId: manifestPacketId,
      });
      await deleteLineItemPresetForTenant(prisma, {
        tenantId,
        userId: FAKE_USER_ID,
        lineItemPresetId: created.id,
      });
      const packet = await prisma.scopePacket.findFirst({
        where: { id: manifestPacketId, tenantId },
        select: { id: true },
      });
      expect(packet?.id).toBe(manifestPacketId);
    });
  });
});
