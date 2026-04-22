import type { PrismaClient } from "@prisma/client";

/**
 * Office-only merged view of **recent** customer-scoped rows (notes + contacts).
 * Not an audit trail, not quote/project/system activity — see UI disclaimer.
 */
export type CustomerRecentActivityKind =
  | "NOTE_ADDED"
  | "NOTE_UPDATED"
  | "CONTACT_ADDED"
  | "CONTACT_UPDATED";

export type CustomerRecentActivityItemDto = {
  kind: CustomerRecentActivityKind;
  occurredAtIso: string;
  noteId?: string;
  contactId?: string;
  /** Note excerpt or contact display name */
  summaryText: string;
  /** Present for NOTE_* */
  actorLabel?: string;
};

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;
const FETCH_CAP = 120;

const ACTIVE_CONTACTS = { archivedAt: null as null };

function clampLimit(raw?: number): number {
  const n = raw ?? DEFAULT_LIMIT;
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(Math.floor(n), MAX_LIMIT);
}

function bodyPreview(body: string, max = 140): string {
  const collapsed = body.replace(/\s+/g, " ").trim();
  if (collapsed.length <= max) return collapsed;
  return `${collapsed.slice(0, max - 1)}…`;
}

/**
 * Merges non-archived notes and active contacts into a single newest-first list.
 * `CONTACT_UPDATED` / `NOTE_UPDATED` only when `updatedAt > createdAt` on the row (coarse signal, not field-level).
 */
export async function listCustomerRecentActivityForTenant(
  prisma: PrismaClient,
  params: { tenantId: string; customerId: string; limit?: number },
): Promise<CustomerRecentActivityItemDto[] | null> {
  const customer = await prisma.customer.findFirst({
    where: { id: params.customerId, tenantId: params.tenantId },
    select: { id: true },
  });
  if (!customer) return null;

  const limit = clampLimit(params.limit);

  const [notes, contacts] = await Promise.all([
    prisma.customerNote.findMany({
      where: {
        customerId: params.customerId,
        tenantId: params.tenantId,
        archivedAt: null,
      },
      orderBy: { createdAt: "desc" },
      take: FETCH_CAP,
      select: {
        id: true,
        body: true,
        createdAt: true,
        updatedAt: true,
        createdBy: { select: { email: true, displayName: true } },
      },
    }),
    prisma.customerContact.findMany({
      where: {
        customerId: params.customerId,
        tenantId: params.tenantId,
        ...ACTIVE_CONTACTS,
      },
      orderBy: { createdAt: "desc" },
      take: FETCH_CAP,
      select: {
        id: true,
        displayName: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  const items: CustomerRecentActivityItemDto[] = [];

  for (const n of notes) {
    const actorLabel = n.createdBy.displayName?.trim() || n.createdBy.email;
    items.push({
      kind: "NOTE_ADDED",
      occurredAtIso: n.createdAt.toISOString(),
      noteId: n.id,
      summaryText: bodyPreview(n.body),
      actorLabel,
    });
    if (n.updatedAt.getTime() > n.createdAt.getTime()) {
      items.push({
        kind: "NOTE_UPDATED",
        occurredAtIso: n.updatedAt.toISOString(),
        noteId: n.id,
        summaryText: bodyPreview(n.body),
      });
    }
  }

  for (const c of contacts) {
    items.push({
      kind: "CONTACT_ADDED",
      occurredAtIso: c.createdAt.toISOString(),
      contactId: c.id,
      summaryText: c.displayName,
    });
    if (c.updatedAt.getTime() > c.createdAt.getTime()) {
      items.push({
        kind: "CONTACT_UPDATED",
        occurredAtIso: c.updatedAt.toISOString(),
        contactId: c.id,
        summaryText: c.displayName,
      });
    }
  }

  items.sort((a, b) => Date.parse(b.occurredAtIso) - Date.parse(a.occurredAtIso));
  return items.slice(0, limit);
}
