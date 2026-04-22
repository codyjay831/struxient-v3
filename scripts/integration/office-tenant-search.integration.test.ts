/**
 * Requires `DATABASE_URL` and a database schema in sync with `prisma/schema.prisma` (run migrations).
 */
import { describe, expect, it } from "vitest";
import { getPrisma } from "../../src/server/db/prisma";
import {
  OFFICE_SEARCH_SECTION_ORDER,
  searchOfficeTenantAnchors,
} from "../../src/server/slice1/reads/office-tenant-search-reads";

describe("office tenant search (Epic 58 foundation)", () => {
  it("scopes results to tenantId and returns stable section ordering", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantA = `srch-a-${suffix}`;
    const tenantB = `srch-b-${suffix}`;
    const token = `ZebraToken${suffix}`;

    await prisma.tenant.createMany({
      data: [
        { id: tenantA, name: "Search A", autoActivateOnSign: false },
        { id: tenantB, name: "Search B", autoActivateOnSign: false },
      ],
    });

    try {
      await prisma.customer.createMany({
        data: [
          { tenantId: tenantA, name: `Alpha ${token} Customer`, primaryEmail: null },
          { tenantId: tenantB, name: `Beta ${token} Other`, primaryEmail: null },
        ],
      });

      const modelA = await searchOfficeTenantAnchors(prisma, { tenantId: tenantA, query: token });
      expect(modelA.refusal).toBeNull();
      expect(modelA.needle).toBe(token);
      expect(modelA.sections.map((s) => s.kind)).toEqual([...OFFICE_SEARCH_SECTION_ORDER]);
      const customerHitsA = modelA.sections.find((s) => s.kind === "customers")?.hits ?? [];
      expect(customerHitsA.length).toBe(1);
      expect(customerHitsA[0]?.title).toContain("Alpha");
      expect(customerHitsA[0]?.href).toMatch(/^\/customers\//);

      const modelB = await searchOfficeTenantAnchors(prisma, { tenantId: tenantB, query: token });
      const customerHitsB = modelB.sections.find((s) => s.kind === "customers")?.hits ?? [];
      expect(customerHitsB.length).toBe(1);
      expect(customerHitsB[0]?.title).toContain("Beta");
      expect(customerHitsB[0]?.title).not.toContain("Alpha");

      const modelAempty = await searchOfficeTenantAnchors(prisma, { tenantId: tenantA, query: "Beta" });
      const onlyBetaName = modelAempty.sections.find((s) => s.kind === "customers")?.hits ?? [];
      expect(onlyBetaName.some((h) => h.title.includes("Beta"))).toBe(false);
    } finally {
      await prisma.customer.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
      await prisma.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
    }
  });

  it("returns refusal for too-short query without scanning", async () => {
    const prisma = getPrisma();
    const tenantId = `srch-ref-${Math.random().toString(36).slice(2, 8)}`;
    await prisma.tenant.create({ data: { id: tenantId, name: "R", autoActivateOnSign: false } });
    try {
      const model = await searchOfficeTenantAnchors(prisma, { tenantId, query: "x" });
      expect(model.refusal).toBe("too_short");
      expect(model.needle).toBe("");
      expect(model.sections.every((s) => s.hits.length === 0)).toBe(true);
    } finally {
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }
  });

  it("absent query yields empty sections and no refusal", async () => {
    const prisma = getPrisma();
    const tenantId = `srch-abs-${Math.random().toString(36).slice(2, 8)}`;
    await prisma.tenant.create({ data: { id: tenantId, name: "A", autoActivateOnSign: false } });
    try {
      const model = await searchOfficeTenantAnchors(prisma, { tenantId, query: "   " });
      expect(model.refusal).toBeNull();
      expect(model.needle).toBe("");
      expect(model.sections.map((s) => s.kind)).toEqual([...OFFICE_SEARCH_SECTION_ORDER]);
    } finally {
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }
  });

  it("finds quote by quoteNumber within tenant", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `srch-q-${suffix}`;
    const qnum = `SRQ-${suffix}`;
    await prisma.tenant.create({ data: { id: tenantId, name: "Q", autoActivateOnSign: false } });
    const userId = `usr-q-${suffix}`;
    await prisma.user.create({
      data: { id: userId, tenantId, email: `q-${suffix}@t.com`, role: "OFFICE_ADMIN" },
    });
    const customer = await prisma.customer.create({ data: { tenantId, name: "C" } });
    const fg = await prisma.flowGroup.create({ data: { tenantId, customerId: customer.id, name: "FG" } });
    const quote = await prisma.quote.create({
      data: { tenantId, customerId: customer.id, flowGroupId: fg.id, quoteNumber: qnum },
    });
    try {
      const model = await searchOfficeTenantAnchors(prisma, { tenantId, query: suffix });
      const hits = model.sections.find((s) => s.kind === "quotes")?.hits ?? [];
      expect(hits.some((h) => h.id === quote.id && h.href === `/quotes/${quote.id}`)).toBe(true);
    } finally {
      await prisma.quote.deleteMany({ where: { id: quote.id } });
      await prisma.flowGroup.deleteMany({ where: { id: fg.id } });
      await prisma.customer.deleteMany({ where: { id: customer.id } });
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }
  });
});
