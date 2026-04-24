import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { convertLeadToQuoteShellForTenant } from "./convert-lead-to-quote-shell";
import {
  createLeadForTenant,
  setLeadStatusForTenant,
  updateLeadForTenant,
} from "./lead-mutations";
import { getLeadForTenant, listLeadsForTenant } from "../reads/lead-reads";

const prisma = new PrismaClient();
const run = Boolean(process.env.DATABASE_URL?.trim());

describe.skipIf(!run)("lead mutations + convert (integration)", () => {
  let tenantId: string;
  let userId: string;
  let otherTenantId: string;
  let otherUserId: string;

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash("test-lead-pass", 6);
    const t = await prisma.tenant.create({
      data: { name: "LeadMutationTestTenant", autoActivateOnSign: false },
    });
    tenantId = t.id;
    const u = await prisma.user.create({
      data: { tenantId, email: `lead-test-${t.id.slice(0, 8)}@example.com`, passwordHash },
    });
    userId = u.id;

    const t2 = await prisma.tenant.create({
      data: { name: "LeadMutationOtherTenant", autoActivateOnSign: false },
    });
    otherTenantId = t2.id;
    const u2 = await prisma.user.create({
      data: { tenantId: otherTenantId, email: `lead-other-${t2.id.slice(0, 8)}@example.com`, passwordHash },
    });
    otherUserId = u2.id;
  });

  async function cleanupTenantQuotes(tid: string) {
    await prisma.proposalGroup.deleteMany({
      where: { quoteVersion: { quote: { tenantId: tid } } },
    });
    await prisma.quoteVersion.deleteMany({
      where: { quote: { tenantId: tid } } },
    );
    await prisma.quote.deleteMany({ where: { tenantId: tid } });
  }

  afterAll(async () => {
    if (!tenantId) return;
    await cleanupTenantQuotes(tenantId);
    await prisma.flowGroup.deleteMany({ where: { tenantId } });
    await prisma.customer.deleteMany({ where: { tenantId } });
    await prisma.lead.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {});

    await cleanupTenantQuotes(otherTenantId);
    await prisma.flowGroup.deleteMany({ where: { tenantId: otherTenantId } });
    await prisma.customer.deleteMany({ where: { tenantId: otherTenantId } });
    await prisma.lead.deleteMany({ where: { tenantId: otherTenantId } });
    await prisma.user.deleteMany({ where: { tenantId: otherTenantId } });
    await prisma.tenant.delete({ where: { id: otherTenantId } }).catch(() => {});

    await prisma.$disconnect();
  });

  it("create + list + get + update", async () => {
    const c = await createLeadForTenant(prisma, {
      tenantId,
      createdByUserId: userId,
      input: { displayName: "  Acme Roof Inquiry  ", source: "web", primaryPhone: "555-0100" },
    });
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    const leadId = c.data.id;

    const list = await listLeadsForTenant(prisma, { tenantId, limit: 10 });
    expect(list.some((x) => x.id === leadId)).toBe(true);

    const detail = await getLeadForTenant(prisma, { tenantId, leadId });
    expect(detail?.displayName).toBe("Acme Roof Inquiry");
    expect(detail?.status).toBe("OPEN");

    const u = await updateLeadForTenant(prisma, {
      tenantId,
      leadId,
      input: { summary: "Needs estimate" },
    });
    expect(u.ok).toBe(true);

    const detail2 = await getLeadForTenant(prisma, { tenantId, leadId });
    expect(detail2?.summary).toBe("Needs estimate");
  });

  it("setLeadStatus rejects CONVERTED manual path", async () => {
    const c = await createLeadForTenant(prisma, {
      tenantId,
      createdByUserId: userId,
      input: { displayName: "Status Path Lead" },
    });
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    const st = await setLeadStatusForTenant(prisma, {
      tenantId,
      leadId: c.data.id,
      input: { nextStatus: "CONVERTED" },
    });
    expect(st.ok).toBe(false);
    if (st.ok) return;
    expect(st.kind).toBe("cannot_set_converted_via_status");
  });

  it("convert creates shell, sets Quote.leadId, marks lead CONVERTED; second convert fails", async () => {
    const c = await createLeadForTenant(prisma, {
      tenantId,
      createdByUserId: userId,
      input: { displayName: "Convert Me" },
    });
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    const leadId = c.data.id;

    const conv = await convertLeadToQuoteShellForTenant(prisma, {
      tenantId,
      actorUserId: userId,
      leadId,
      input: { customerName: "Convert Me Customer", flowGroupName: "Site One" },
    });
    expect(conv.ok).toBe(true);
    if (!conv.ok) return;

    const q = await prisma.quote.findFirst({
      where: { id: conv.data.quoteId, tenantId },
      select: { leadId: true, customerId: true, flowGroupId: true },
    });
    expect(q?.leadId).toBe(leadId);
    expect(q?.customerId).toBe(conv.data.customerId);
    expect(q?.flowGroupId).toBe(conv.data.flowGroupId);

    const lead = await prisma.lead.findFirst({
      where: { id: leadId },
      select: { status: true, convertedAt: true, convertedCustomerId: true, convertedFlowGroupId: true },
    });
    expect(lead?.status).toBe("CONVERTED");
    expect(lead?.convertedCustomerId).toBe(conv.data.customerId);
    expect(lead?.convertedFlowGroupId).toBe(conv.data.flowGroupId);
    expect(lead?.convertedAt).toBeTruthy();

    const conv2 = await convertLeadToQuoteShellForTenant(prisma, {
      tenantId,
      actorUserId: userId,
      leadId,
      input: { customerName: "Nope", flowGroupName: "Nope" },
    });
    expect(conv2.ok).toBe(false);
    if (conv2.ok) return;
    expect(conv2.kind).toBe("lead_already_converted");
  });

  it("convert rejects lead from other tenant", async () => {
    const c = await createLeadForTenant(prisma, {
      tenantId: otherTenantId,
      createdByUserId: otherUserId,
      input: { displayName: "Other tenant lead" },
    });
    expect(c.ok).toBe(true);
    if (!c.ok) return;

    const conv = await convertLeadToQuoteShellForTenant(prisma, {
      tenantId,
      actorUserId: userId,
      leadId: c.data.id,
      input: { customerName: "X", flowGroupName: "Y" },
    });
    expect(conv.ok).toBe(false);
    if (conv.ok) return;
    expect(conv.kind).toBe("lead_not_found");
  });

  it("update rejects CONVERTED lead", async () => {
    const c = await createLeadForTenant(prisma, {
      tenantId,
      createdByUserId: userId,
      input: { displayName: "Immutable After Convert" },
    });
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    const leadId = c.data.id;
    const conv = await convertLeadToQuoteShellForTenant(prisma, {
      tenantId,
      actorUserId: userId,
      leadId,
      input: { customerName: "C1", flowGroupName: "F1" },
    });
    expect(conv.ok).toBe(true);

    const u = await updateLeadForTenant(prisma, {
      tenantId,
      leadId,
      input: { summary: "nope" },
    });
    expect(u.ok).toBe(false);
    if (u.ok) return;
    expect(u.kind).toBe("lead_immutable");
  });

  it("convert rejects non-OPEN lead", async () => {
    const c = await createLeadForTenant(prisma, {
      tenantId,
      createdByUserId: userId,
      input: { displayName: "On hold lead" },
    });
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    await setLeadStatusForTenant(prisma, {
      tenantId,
      leadId: c.data.id,
      input: { nextStatus: "ON_HOLD" },
    });
    const conv = await convertLeadToQuoteShellForTenant(prisma, {
      tenantId,
      actorUserId: userId,
      leadId: c.data.id,
      input: { customerName: "C", flowGroupName: "F" },
    });
    expect(conv.ok).toBe(false);
    if (conv.ok) return;
    expect(conv.kind).toBe("lead_not_open");
  });

  it("create rejects assignee outside tenant", async () => {
    const c = await createLeadForTenant(prisma, {
      tenantId,
      createdByUserId: userId,
      input: { displayName: "Bad assignee", assignedToUserId: otherUserId },
    });
    expect(c.ok).toBe(false);
    if (c.ok) return;
    expect(c.kind).toBe("assignee_not_in_tenant");
  });
});
