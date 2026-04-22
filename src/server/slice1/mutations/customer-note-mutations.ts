import type { PrismaClient } from "@prisma/client";
import { InvariantViolationError } from "../errors";

/** Epic 05 plain-text cap (align with notes epic §16). */
const BODY_MAX = 10_000;

function assertCustomerNoteBody(raw: string): string {
  const s = raw.trim();
  if (s.length === 0 || s.length > BODY_MAX) {
    throw new InvariantViolationError(
      "CUSTOMER_NOTE_BODY_INVALID",
      `Note body must be 1–${BODY_MAX} characters after trimming.`,
      { length: s.length },
    );
  }
  return s;
}

export type CustomerNoteMutationDto = {
  id: string;
  body: string;
  archivedAtIso: string | null;
  updatedAtIso: string;
};

export async function createCustomerNoteForTenant(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    customerId: string;
    actorUserId: string;
    body: string;
  },
): Promise<CustomerNoteMutationDto | "parent_not_found"> {
  const customer = await prisma.customer.findFirst({
    where: { id: params.customerId, tenantId: params.tenantId },
    select: { id: true, tenantId: true },
  });
  if (!customer) return "parent_not_found";

  const actor = await prisma.user.findFirst({
    where: { id: params.actorUserId, tenantId: params.tenantId },
    select: { id: true },
  });
  if (!actor) {
    throw new InvariantViolationError(
      "CUSTOMER_NOTE_AUTHOR_NOT_FOUND",
      "Actor user not found for this tenant.",
      { actorUserId: params.actorUserId },
    );
  }

  const body = assertCustomerNoteBody(params.body);

  const row = await prisma.customerNote.create({
    data: {
      tenantId: customer.tenantId,
      customerId: customer.id,
      createdById: actor.id,
      body,
    },
    select: { id: true, body: true, archivedAt: true, updatedAt: true },
  });

  return {
    id: row.id,
    body: row.body,
    archivedAtIso: row.archivedAt?.toISOString() ?? null,
    updatedAtIso: row.updatedAt.toISOString(),
  };
}

export type UpdateCustomerNoteInput = {
  tenantId: string;
  customerId: string;
  noteId: string;
  /** Must match `CustomerNote.createdById` to change body or archive state. */
  actorUserId: string;
  body?: string;
  archived?: boolean;
};

export async function updateCustomerNoteForTenant(
  prisma: PrismaClient,
  input: UpdateCustomerNoteInput,
): Promise<CustomerNoteMutationDto | "not_found"> {
  const existing = await prisma.customerNote.findFirst({
    where: {
      id: input.noteId,
      customerId: input.customerId,
      tenantId: input.tenantId,
    },
    select: { id: true, createdById: true },
  });
  if (!existing) return "not_found";

  if (existing.createdById !== input.actorUserId) {
    throw new InvariantViolationError(
      "CUSTOMER_NOTE_UPDATE_NOT_AUTHORIZED",
      "Only the author of this note may edit or change its archive state.",
      { noteId: input.noteId, actorUserId: input.actorUserId },
    );
  }

  const data: { body?: string; archivedAt?: Date | null } = {};
  if (input.body !== undefined) {
    data.body = assertCustomerNoteBody(input.body);
  }
  if (input.archived !== undefined) {
    data.archivedAt = input.archived ? new Date() : null;
  }

  if (Object.keys(data).length === 0) {
    const row = await prisma.customerNote.findFirst({
      where: { id: existing.id },
      select: { id: true, body: true, archivedAt: true, updatedAt: true },
    });
    if (!row) return "not_found";
    return {
      id: row.id,
      body: row.body,
      archivedAtIso: row.archivedAt?.toISOString() ?? null,
      updatedAtIso: row.updatedAt.toISOString(),
    };
  }

  const row = await prisma.customerNote.update({
    where: { id: existing.id },
    data,
    select: { id: true, body: true, archivedAt: true, updatedAt: true },
  });

  return {
    id: row.id,
    body: row.body,
    archivedAtIso: row.archivedAt?.toISOString() ?? null,
    updatedAtIso: row.updatedAt.toISOString(),
  };
}
