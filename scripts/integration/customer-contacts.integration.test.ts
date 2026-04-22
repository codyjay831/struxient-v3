import { describe, expect, it } from "vitest";
import { getPrisma } from "../../src/server/db/prisma";
import {
  createCustomerContactForTenant,
  createCustomerContactMethodForTenant,
  updateCustomerContactForTenant,
  updateCustomerContactMethodForTenant,
} from "../../src/server/slice1/mutations/customer-contact-mutations";
import { listCustomerContactsForTenant } from "../../src/server/slice1/reads/customer-contact-reads";

describe("customer contacts foundation", () => {
  it("lists tenant-scoped contacts with methods for a customer", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantA = `ct-a-${suffix}`;
    const tenantB = `ct-b-${suffix}`;
    const userA = `user-ct-a-${suffix}`;
    const userB = `user-ct-b-${suffix}`;

    await prisma.tenant.create({ data: { id: tenantA, name: "A" } });
    await prisma.tenant.create({ data: { id: tenantB, name: "B" } });
    await prisma.user.create({
      data: { id: userA, tenantId: tenantA, email: `a-${suffix}@t.com`, role: "OFFICE_ADMIN" },
    });
    await prisma.user.create({
      data: { id: userB, tenantId: tenantB, email: `b-${suffix}@t.com`, role: "OFFICE_ADMIN" },
    });
    const custA = await prisma.customer.create({ data: { tenantId: tenantA, name: "CA" } });
    const custB = await prisma.customer.create({ data: { tenantId: tenantB, name: "CB" } });

    try {
      const created = await createCustomerContactForTenant(prisma, {
        tenantId: tenantA,
        customerId: custA.id,
        actorUserId: userA,
        displayName: "Alex Site",
        role: "SITE",
      });
      if (created === "parent_not_found") throw new Error("unexpected");
      await createCustomerContactMethodForTenant(prisma, {
        tenantId: tenantA,
        customerId: custA.id,
        contactId: created.id,
        actorUserId: userA,
        type: "EMAIL",
        value: "Alex@Example.COM",
        isPrimary: true,
      });

      const listA = await listCustomerContactsForTenant(prisma, { tenantId: tenantA, customerId: custA.id });
      expect(listA).not.toBeNull();
      expect(listA!).toHaveLength(1);
      expect(listA![0]!.displayName).toBe("Alex Site");
      expect(listA![0]!.role).toBe("SITE");
      expect(listA![0]!.methods).toHaveLength(1);
      expect(listA![0]!.methods[0]!.type).toBe("EMAIL");
      expect(listA![0]!.methods[0]!.value).toBe("alex@example.com");

      const cross = await listCustomerContactsForTenant(prisma, { tenantId: tenantB, customerId: custA.id });
      expect(cross).toBeNull();

      const emptyB = await listCustomerContactsForTenant(prisma, { tenantId: tenantB, customerId: custB.id });
      expect(emptyB).toEqual([]);
    } finally {
      await prisma.customerContact.deleteMany({ where: { customerId: { in: [custA.id, custB.id] } } });
      await prisma.auditEvent.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
      await prisma.customer.deleteMany({ where: { id: { in: [custA.id, custB.id] } } });
      await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } });
      await prisma.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
    }
  });

  it("keeps at most one primary per method type customer-wide (active contacts in list reads)", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `ct-pri-${suffix}`;
    const userId = `user-ct-pri-${suffix}`;
    await prisma.tenant.create({ data: { id: tenantId, name: "T" } });
    await prisma.user.create({
      data: { id: userId, tenantId, email: `pri-${suffix}@t.com`, role: "OFFICE_ADMIN" },
    });
    const cust = await prisma.customer.create({ data: { tenantId, name: "C" } });

    try {
      const c1 = await createCustomerContactForTenant(prisma, {
        tenantId,
        customerId: cust.id,
        actorUserId: userId,
        displayName: "Billing",
      });
      const c2 = await createCustomerContactForTenant(prisma, {
        tenantId,
        customerId: cust.id,
        actorUserId: userId,
        displayName: "Site",
      });
      if (c1 === "parent_not_found" || c2 === "parent_not_found") throw new Error("unexpected");

      const m1 = await createCustomerContactMethodForTenant(prisma, {
        tenantId,
        customerId: cust.id,
        contactId: c1.id,
        actorUserId: userId,
        type: "EMAIL",
        value: "billing@example.com",
        isPrimary: true,
      });
      if (m1 === "not_found") throw new Error("unexpected");
      expect(m1.isPrimary).toBe(true);

      const m2 = await createCustomerContactMethodForTenant(prisma, {
        tenantId,
        customerId: cust.id,
        contactId: c2.id,
        actorUserId: userId,
        type: "EMAIL",
        value: "site@example.com",
        isPrimary: true,
      });
      if (m2 === "not_found") throw new Error("unexpected");
      expect(m2.isPrimary).toBe(true);

      const list = await listCustomerContactsForTenant(prisma, { tenantId, customerId: cust.id });
      expect(list).not.toBeNull();
      const primaryEmails = list!
        .flatMap((c) => c.methods)
        .filter((m) => m.type === "EMAIL" && m.isPrimary);
      expect(primaryEmails).toHaveLength(1);
      expect(primaryEmails[0]!.value).toBe("site@example.com");

      const promoted = await updateCustomerContactMethodForTenant(prisma, {
        tenantId,
        customerId: cust.id,
        contactId: c1.id,
        methodId: m1.id,
        actorUserId: userId,
        isPrimary: true,
      });
      if (promoted === "not_found") throw new Error("unexpected");
      expect(promoted.isPrimary).toBe(true);

      const after = await listCustomerContactsForTenant(prisma, { tenantId, customerId: cust.id });
      const primaryEmails2 = after!
        .flatMap((c) => c.methods)
        .filter((m) => m.type === "EMAIL" && m.isPrimary);
      expect(primaryEmails2).toHaveLength(1);
      expect(primaryEmails2[0]!.value).toBe("billing@example.com");

      await createCustomerContactMethodForTenant(prisma, {
        tenantId,
        customerId: cust.id,
        contactId: c1.id,
        actorUserId: userId,
        type: "PHONE",
        value: "555-0001",
        isPrimary: true,
      });
      const withPhone = await listCustomerContactsForTenant(prisma, { tenantId, customerId: cust.id });
      const primaryPhones = withPhone!
        .flatMap((c) => c.methods)
        .filter((m) => m.type === "PHONE" && m.isPrimary);
      const primaryEmails3 = withPhone!
        .flatMap((c) => c.methods)
        .filter((m) => m.type === "EMAIL" && m.isPrimary);
      expect(primaryPhones).toHaveLength(1);
      expect(primaryEmails3).toHaveLength(1);
    } finally {
      await prisma.customerContact.deleteMany({ where: { customerId: cust.id } });
      await prisma.auditEvent.deleteMany({ where: { tenantId } });
      await prisma.customer.deleteMany({ where: { id: cust.id } });
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }
  });

  it("demotes primary on an archived contact when a new primary of the same type is created on an active contact", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `ct-pri-a-${suffix}`;
    const userId = `user-ct-pri-a-${suffix}`;
    await prisma.tenant.create({ data: { id: tenantId, name: "T" } });
    await prisma.user.create({
      data: { id: userId, tenantId, email: `pri-a-${suffix}@t.com`, role: "OFFICE_ADMIN" },
    });
    const cust = await prisma.customer.create({ data: { tenantId, name: "C" } });

    try {
      const legacy = await createCustomerContactForTenant(prisma, {
        tenantId,
        customerId: cust.id,
        actorUserId: userId,
        displayName: "Legacy",
      });
      const current = await createCustomerContactForTenant(prisma, {
        tenantId,
        customerId: cust.id,
        actorUserId: userId,
        displayName: "Current",
      });
      if (legacy === "parent_not_found" || current === "parent_not_found") throw new Error("unexpected");

      const mLegacy = await createCustomerContactMethodForTenant(prisma, {
        tenantId,
        customerId: cust.id,
        contactId: legacy.id,
        actorUserId: userId,
        type: "EMAIL",
        value: "legacy@example.com",
        isPrimary: true,
      });
      if (mLegacy === "not_found") throw new Error("unexpected");

      const arch = await updateCustomerContactForTenant(prisma, {
        tenantId,
        customerId: cust.id,
        contactId: legacy.id,
        actorUserId: userId,
        archived: true,
      });
      if (arch === "not_found") throw new Error("unexpected");

      await createCustomerContactMethodForTenant(prisma, {
        tenantId,
        customerId: cust.id,
        contactId: current.id,
        actorUserId: userId,
        type: "EMAIL",
        value: "current@example.com",
        isPrimary: true,
      });

      const legacyMethod = await prisma.customerContactMethod.findUnique({
        where: { id: mLegacy.id },
        select: { isPrimary: true },
      });
      expect(legacyMethod?.isPrimary).toBe(false);
    } finally {
      await prisma.customerContact.deleteMany({ where: { customerId: cust.id } });
      await prisma.auditEvent.deleteMany({ where: { tenantId } });
      await prisma.customer.deleteMany({ where: { id: cust.id } });
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }
  });
});
