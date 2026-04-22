import { describe, expect, it } from "vitest";
import { getPrisma } from "../../src/server/db/prisma";
import { createCustomerContactForTenant } from "../../src/server/slice1/mutations/customer-contact-mutations";
import { createCustomerNoteForTenant, updateCustomerNoteForTenant } from "../../src/server/slice1/mutations/customer-note-mutations";
import { listCustomerRecentActivityForTenant } from "../../src/server/slice1/reads/customer-recent-activity-reads";

describe("customer recent activity summary (merged read)", () => {
  it("returns null for unknown customer / wrong tenant", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `cra-${suffix}`;
    await prisma.tenant.create({ data: { id: tenantId, name: "T" } });
    try {
      const missing = await listCustomerRecentActivityForTenant(prisma, {
        tenantId,
        customerId: "nonexistent-customer-id",
      });
      expect(missing).toBeNull();
    } finally {
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }
  });

  it("merges note and contact timestamps, newest first, with update rows when updatedAt > createdAt", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `cra2-${suffix}`;
    const userId = `user-cra2-${suffix}`;
    await prisma.tenant.create({ data: { id: tenantId, name: "T" } });
    await prisma.user.create({
      data: { id: userId, tenantId, email: `cra2-${suffix}@t.com`, role: "OFFICE_ADMIN" },
    });
    const customer = await prisma.customer.create({ data: { tenantId, name: "Acme" } });

    try {
      const contact = await createCustomerContactForTenant(prisma, {
        tenantId,
        customerId: customer.id,
        actorUserId: userId,
        displayName: "Pat Owner",
        role: "OWNER",
      });
      if (contact === "parent_not_found") throw new Error("unexpected");

      const note = await createCustomerNoteForTenant(prisma, {
        tenantId,
        customerId: customer.id,
        actorUserId: userId,
        body: "Kickoff context",
      });
      if (note === "parent_not_found") throw new Error("unexpected");

      const updNote = await updateCustomerNoteForTenant(prisma, {
        tenantId,
        customerId: customer.id,
        noteId: note.id,
        actorUserId: userId,
        body: "Kickoff context — revised",
      });
      if (updNote === "not_found") throw new Error("unexpected");

      const activity = await listCustomerRecentActivityForTenant(prisma, {
        tenantId,
        customerId: customer.id,
        limit: 20,
      });
      expect(activity).not.toBeNull();
      const kinds = activity!.map((a) => a.kind);
      expect(kinds).toContain("NOTE_ADDED");
      expect(kinds).toContain("NOTE_UPDATED");
      expect(kinds).toContain("CONTACT_ADDED");
      expect(kinds).not.toContain("CONTACT_UPDATED");

      for (let i = 1; i < activity!.length; i++) {
        const prev = Date.parse(activity![i - 1]!.occurredAtIso);
        const cur = Date.parse(activity![i]!.occurredAtIso);
        expect(prev).toBeGreaterThanOrEqual(cur);
      }

      const updContact = await prisma.customerContact.update({
        where: { id: contact.id },
        data: { displayName: "Pat Owner Jr" },
      });
      expect(updContact.updatedAt.getTime()).toBeGreaterThan(updContact.createdAt.getTime());

      const afterContactEdit = await listCustomerRecentActivityForTenant(prisma, {
        tenantId,
        customerId: customer.id,
        limit: 30,
      });
      expect(afterContactEdit!.map((a) => a.kind)).toContain("CONTACT_UPDATED");
      const updatedRow = afterContactEdit!.find((a) => a.kind === "CONTACT_UPDATED");
      expect(updatedRow?.summaryText).toBe("Pat Owner Jr");
    } finally {
      await prisma.customerNote.deleteMany({ where: { customerId: customer.id } });
      await prisma.customerContact.deleteMany({ where: { customerId: customer.id } });
      await prisma.auditEvent.deleteMany({ where: { tenantId } });
      await prisma.customer.deleteMany({ where: { id: customer.id } });
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }
  });
});
