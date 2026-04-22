import { describe, expect, it } from "vitest";
import { getPrisma } from "../../src/server/db/prisma";
import { getQuoteWorkspaceForTenant } from "../../src/server/slice1/reads/quote-workspace-reads";

describe("quote workspace pre-job tasks read", () => {
  it("returns tenant + flowGroup scoped PreJobTask rows with quote-version link metadata", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantA = `pj-ws-a-${suffix}`;
    const tenantB = `pj-ws-b-${suffix}`;
    const userA = `user-pj-a-${suffix}`;
    const userB = `user-pj-b-${suffix}`;

    await prisma.tenant.create({ data: { id: tenantA, name: "A" } });
    await prisma.tenant.create({ data: { id: tenantB, name: "B" } });
    await prisma.user.create({
      data: { id: userA, tenantId: tenantA, email: `a-${suffix}@t.com`, role: "OFFICE_ADMIN" },
    });
    await prisma.user.create({
      data: { id: userB, tenantId: tenantB, email: `b-${suffix}@t.com`, role: "OFFICE_ADMIN" },
    });

    const custA = await prisma.customer.create({ data: { tenantId: tenantA, name: "CA" } });
    const fgA = await prisma.flowGroup.create({
      data: { tenantId: tenantA, customerId: custA.id, name: "Site A" },
    });
    const quoteA = await prisma.quote.create({
      data: { tenantId: tenantA, customerId: custA.id, flowGroupId: fgA.id, quoteNumber: `Q-${suffix}` },
    });
    const qvA = await prisma.quoteVersion.create({
      data: { quoteId: quoteA.id, versionNumber: 1, status: "DRAFT", createdById: userA },
    });

    const fgOther = await prisma.flowGroup.create({
      data: { tenantId: tenantA, customerId: custA.id, name: "Other site" },
    });

    await prisma.preJobTask.create({
      data: {
        tenantId: tenantA,
        flowGroupId: fgA.id,
        quoteVersionId: qvA.id,
        taskType: "SITE_WALK",
        sourceType: "OFFICE",
        title: "Walk the lot",
        status: "OPEN",
        createdById: userA,
      },
    });

    await prisma.preJobTask.create({
      data: {
        tenantId: tenantA,
        flowGroupId: fgOther.id,
        taskType: "OTHER",
        sourceType: "OFFICE",
        title: "Wrong site",
        status: "OPEN",
        createdById: userA,
      },
    });

    try {
      const ws = await getQuoteWorkspaceForTenant(prisma, { tenantId: tenantA, quoteId: quoteA.id });
      expect(ws).not.toBeNull();
      expect(ws!.preJobTasks).toHaveLength(1);
      const t = ws!.preJobTasks[0]!;
      expect(t.title).toBe("Walk the lot");
      expect(t.status).toBe("OPEN");
      expect(t.taskType).toBe("SITE_WALK");
      expect(t.sourceType).toBe("OFFICE");
      expect(t.linkedQuoteVersionNumber).toBe(1);
      expect(t.quoteVersionScopeHref).toBe(`/quotes/${quoteA.id}/versions/${encodeURIComponent(qvA.id)}/scope`);

      const wsB = await getQuoteWorkspaceForTenant(prisma, { tenantId: tenantB, quoteId: quoteA.id });
      expect(wsB).toBeNull();
    } finally {
      await prisma.preJobTask.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
      await prisma.quoteVersion.deleteMany({ where: { quoteId: quoteA.id } });
      await prisma.quote.deleteMany({ where: { id: quoteA.id } });
      await prisma.flowGroup.deleteMany({ where: { id: { in: [fgA.id, fgOther.id] } } });
      await prisma.customer.deleteMany({ where: { id: custA.id } });
      await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } });
      await prisma.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
    }
  });
});
