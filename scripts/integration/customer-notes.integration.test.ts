import { describe, expect, it } from "vitest";
import { getPrisma } from "../../src/server/db/prisma";
import { createCustomerNoteForTenant, updateCustomerNoteForTenant } from "../../src/server/slice1/mutations/customer-note-mutations";
import { listCustomerNotesForTenant } from "../../src/server/slice1/reads/customer-note-reads";

describe("customer notes foundation", () => {
  it("creates, lists, updates, and archives tenant-scoped notes on a customer", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantA = `cn-a-${suffix}`;
    const tenantB = `cn-b-${suffix}`;
    const userA = `user-cn-a-${suffix}`;
    const userB = `user-cn-b-${suffix}`;

    await prisma.tenant.create({ data: { id: tenantA, name: "A" } });
    await prisma.tenant.create({ data: { id: tenantB, name: "B" } });
    await prisma.user.create({
      data: { id: userA, tenantId: tenantA, email: `a-${suffix}@t.com`, role: "OFFICE_ADMIN" },
    });
    await prisma.user.create({
      data: { id: userB, tenantId: tenantB, email: `b-${suffix}@t.com`, role: "OFFICE_ADMIN" },
    });
    const custA = await prisma.customer.create({ data: { tenantId: tenantA, name: "CA" } });

    try {
      const created = await createCustomerNoteForTenant(prisma, {
        tenantId: tenantA,
        customerId: custA.id,
        actorUserId: userA,
        body: "  First context line  ",
      });
      if (created === "parent_not_found") throw new Error("unexpected");
      expect(created.body).toBe("First context line");

      const listA = await listCustomerNotesForTenant(prisma, { tenantId: tenantA, customerId: custA.id });
      expect(listA).not.toBeNull();
      expect(listA!).toHaveLength(1);
      expect(listA![0]!.createdByLabel).toContain("@");

      const cross = await listCustomerNotesForTenant(prisma, { tenantId: tenantB, customerId: custA.id });
      expect(cross).toBeNull();

      const upd = await updateCustomerNoteForTenant(prisma, {
        tenantId: tenantA,
        customerId: custA.id,
        noteId: created.id,
        actorUserId: userA,
        body: "Updated body text here.",
      });
      if (upd === "not_found") throw new Error("unexpected");
      expect(upd.body).toBe("Updated body text here.");

      const arch = await updateCustomerNoteForTenant(prisma, {
        tenantId: tenantA,
        customerId: custA.id,
        noteId: created.id,
        actorUserId: userA,
        archived: true,
      });
      if (arch === "not_found") throw new Error("unexpected");
      expect(arch.archivedAtIso).not.toBeNull();

      const after = await listCustomerNotesForTenant(prisma, { tenantId: tenantA, customerId: custA.id });
      expect(after).toEqual([]);
    } finally {
      await prisma.customerNote.deleteMany({ where: { customerId: custA.id } });
      await prisma.customer.deleteMany({ where: { id: custA.id } });
      await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } });
      await prisma.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
    }
  });

  it("rejects body or archive updates when actor is not the note author (same tenant)", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `cn-auth-${suffix}`;
    const authorId = `user-cn-auth-a-${suffix}`;
    const otherId = `user-cn-auth-b-${suffix}`;
    await prisma.tenant.create({ data: { id: tenantId, name: "T" } });
    await prisma.user.create({
      data: { id: authorId, tenantId, email: `auth-a-${suffix}@t.com`, role: "OFFICE_ADMIN" },
    });
    await prisma.user.create({
      data: { id: otherId, tenantId, email: `auth-b-${suffix}@t.com`, role: "OFFICE_ADMIN" },
    });
    const cust = await prisma.customer.create({ data: { tenantId, name: "C" } });

    try {
      const created = await createCustomerNoteForTenant(prisma, {
        tenantId,
        customerId: cust.id,
        actorUserId: authorId,
        body: "Author-only slice",
      });
      if (created === "parent_not_found") throw new Error("unexpected");

      await expect(
        updateCustomerNoteForTenant(prisma, {
          tenantId,
          customerId: cust.id,
          noteId: created.id,
          actorUserId: otherId,
          body: "Tampered",
        }),
      ).rejects.toMatchObject({ code: "CUSTOMER_NOTE_UPDATE_NOT_AUTHORIZED" });

      await expect(
        updateCustomerNoteForTenant(prisma, {
          tenantId,
          customerId: cust.id,
          noteId: created.id,
          actorUserId: otherId,
          archived: true,
        }),
      ).rejects.toMatchObject({ code: "CUSTOMER_NOTE_UPDATE_NOT_AUTHORIZED" });

      const list = await listCustomerNotesForTenant(prisma, { tenantId, customerId: cust.id });
      expect(list![0]!.body).toBe("Author-only slice");
    } finally {
      await prisma.customerNote.deleteMany({ where: { customerId: cust.id } });
      await prisma.customer.deleteMany({ where: { id: cust.id } });
      await prisma.user.deleteMany({ where: { id: { in: [authorId, otherId] } } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }
  });
});
