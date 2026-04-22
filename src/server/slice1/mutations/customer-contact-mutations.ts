import type {
  CustomerContactMethodType,
  CustomerContactRole,
  PrismaClient,
} from "@prisma/client";
import { InvariantViolationError } from "../errors";

const DISPLAY_NAME_MAX = 120;
const NOTES_MAX = 2000;
const VALUE_PHONE_MAX = 64;
const VALUE_OTHER_MAX = 500;

const SIMPLE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function assertCustomerContactDisplayName(raw: string): string {
  const s = raw.trim();
  if (s.length === 0 || s.length > DISPLAY_NAME_MAX) {
    throw new InvariantViolationError(
      "CUSTOMER_CONTACT_DISPLAY_NAME_INVALID",
      `Contact display name must be 1–${DISPLAY_NAME_MAX} non-whitespace characters.`,
      { length: s.length },
    );
  }
  return s;
}

function normalizeNotes(raw: string | null | undefined): string | null {
  if (raw == null || raw === "") return null;
  const s = raw.trim();
  if (s.length > NOTES_MAX) {
    throw new InvariantViolationError(
      "CUSTOMER_CONTACT_NOTES_TOO_LONG",
      `Notes must be at most ${NOTES_MAX} characters.`,
      { length: s.length },
    );
  }
  return s.length === 0 ? null : s;
}

function parseRole(raw: unknown): CustomerContactRole | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw !== "string") {
    throw new InvariantViolationError(
      "CUSTOMER_CONTACT_ROLE_INVALID",
      "role must be a string or omitted.",
      {},
    );
  }
  const allowed: CustomerContactRole[] = ["BILLING", "SITE", "OWNER", "OTHER"];
  if (!allowed.includes(raw as CustomerContactRole)) {
    throw new InvariantViolationError(
      "CUSTOMER_CONTACT_ROLE_INVALID",
      "role must be one of BILLING, SITE, OWNER, OTHER, or omitted.",
      { role: raw },
    );
  }
  return raw as CustomerContactRole;
}

function assertMethodValue(type: CustomerContactMethodType, raw: string): string {
  const v = raw.trim();
  if (v.length === 0) {
    throw new InvariantViolationError(
      "CUSTOMER_CONTACT_METHOD_VALUE_INVALID",
      "Method value cannot be empty.",
      { type },
    );
  }
  if (type === "EMAIL") {
    const lower = v.toLowerCase();
    if (lower.length > 254 || !SIMPLE_EMAIL.test(lower)) {
      throw new InvariantViolationError(
        "CUSTOMER_CONTACT_METHOD_VALUE_INVALID",
        "Email method value must look like a valid email address.",
        { type },
      );
    }
    return lower;
  }
  if (type === "PHONE" || type === "MOBILE") {
    if (v.length > VALUE_PHONE_MAX) {
      throw new InvariantViolationError(
        "CUSTOMER_CONTACT_METHOD_VALUE_INVALID",
        `Phone-style value must be at most ${VALUE_PHONE_MAX} characters.`,
        { type, length: v.length },
      );
    }
    return v;
  }
  if (v.length > VALUE_OTHER_MAX) {
    throw new InvariantViolationError(
      "CUSTOMER_CONTACT_METHOD_VALUE_INVALID",
      `Value must be at most ${VALUE_OTHER_MAX} characters for this method type.`,
      { type, length: v.length },
    );
  }
  return v;
}

async function loadContactAnyForTenant(
  prisma: PrismaClient,
  params: { tenantId: string; customerId: string; contactId: string },
) {
  return prisma.customerContact.findFirst({
    where: {
      id: params.contactId,
      customerId: params.customerId,
      tenantId: params.tenantId,
    },
    select: { id: true, archivedAt: true },
  });
}

async function loadActiveContactForTenant(
  prisma: PrismaClient,
  params: { tenantId: string; customerId: string; contactId: string },
) {
  return prisma.customerContact.findFirst({
    where: {
      id: params.contactId,
      customerId: params.customerId,
      tenantId: params.tenantId,
      archivedAt: null,
    },
    select: { id: true, archivedAt: true },
  });
}

export type CreateCustomerContactInput = {
  tenantId: string;
  customerId: string;
  displayName: string;
  role?: unknown;
  notes?: string | null;
};

export type CustomerContactMutationDto = {
  id: string;
  displayName: string;
  role: CustomerContactRole | null;
  notes: string | null;
};

export async function createCustomerContactForTenant(
  prisma: PrismaClient,
  input: CreateCustomerContactInput,
): Promise<CustomerContactMutationDto | "parent_not_found"> {
  const customer = await prisma.customer.findFirst({
    where: { id: input.customerId, tenantId: input.tenantId },
    select: { id: true, tenantId: true },
  });
  if (!customer) return "parent_not_found";

  const displayName = assertCustomerContactDisplayName(input.displayName);
  const notes = normalizeNotes(input.notes);
  const role = input.role === undefined ? null : parseRole(input.role);

  const row = await prisma.customerContact.create({
    data: {
      tenantId: customer.tenantId,
      customerId: customer.id,
      displayName,
      role,
      notes,
    },
    select: { id: true, displayName: true, role: true, notes: true },
  });
  return row;
}

export type UpdateCustomerContactMethodInput = {
  tenantId: string;
  customerId: string;
  contactId: string;
  methodId: string;
  value?: string;
  isPrimary?: boolean;
  okToSms?: boolean;
  okToEmail?: boolean;
};

export type UpdateCustomerContactInput = {
  tenantId: string;
  customerId: string;
  contactId: string;
  displayName?: string;
  role?: unknown;
  notes?: string | null;
  /** When true, soft-archive; when false, clear archive. */
  archived?: boolean;
};

export async function updateCustomerContactForTenant(
  prisma: PrismaClient,
  input: UpdateCustomerContactInput,
): Promise<CustomerContactMutationDto | "not_found"> {
  const existing = await loadContactAnyForTenant(prisma, input);
  if (!existing) return "not_found";

  const data: {
    displayName?: string;
    role?: CustomerContactRole | null;
    notes?: string | null;
    archivedAt?: Date | null;
  } = {};

  if (input.displayName !== undefined) {
    data.displayName = assertCustomerContactDisplayName(input.displayName);
  }
  if (input.role !== undefined) {
    data.role = input.role === null || input.role === "" ? null : parseRole(input.role);
  }
  if (input.notes !== undefined) {
    data.notes = normalizeNotes(input.notes);
  }
  if (input.archived !== undefined) {
    data.archivedAt = input.archived ? new Date() : null;
  }

  if (Object.keys(data).length === 0) {
    const row = await prisma.customerContact.findFirst({
      where: { id: existing.id },
      select: { id: true, displayName: true, role: true, notes: true },
    });
    if (!row) return "not_found";
    return row;
  }

  const row = await prisma.customerContact.update({
    where: { id: existing.id },
    data,
    select: { id: true, displayName: true, role: true, notes: true },
  });
  return row;
}

export type CreateCustomerContactMethodInput = {
  tenantId: string;
  customerId: string;
  contactId: string;
  type: CustomerContactMethodType;
  value: string;
  isPrimary?: boolean;
  okToSms?: boolean;
  okToEmail?: boolean;
};

export type CustomerContactMethodMutationDto = {
  id: string;
  type: CustomerContactMethodType;
  value: string;
  isPrimary: boolean;
  okToSms: boolean;
  okToEmail: boolean;
};

/**
 * At most one primary per `(customer, method type)` across all of that customer's contacts
 * (including archived contacts — a stale primary on an archived row would otherwise contradict
 * the active row the office uses).
 */
async function clearPrimaryCustomerWidePerType(
  tx: Pick<PrismaClient, "customerContactMethod">,
  params: { tenantId: string; customerId: string; type: CustomerContactMethodType },
  exceptMethodId?: string,
) {
  await tx.customerContactMethod.updateMany({
    where: {
      type: params.type,
      contact: {
        customerId: params.customerId,
        tenantId: params.tenantId,
      },
      ...(exceptMethodId ? { NOT: { id: exceptMethodId } } : {}),
    },
    data: { isPrimary: false },
  });
}

export async function createCustomerContactMethodForTenant(
  prisma: PrismaClient,
  input: CreateCustomerContactMethodInput,
): Promise<CustomerContactMethodMutationDto | "not_found"> {
  const contact = await loadActiveContactForTenant(prisma, input);
  if (!contact) return "not_found";

  const value = assertMethodValue(input.type, input.value);
  const isPrimary = input.isPrimary === true;
  const okToSms = input.okToSms === true;
  const okToEmail = input.okToEmail === true;

  return prisma.$transaction(async (tx) => {
    if (isPrimary) {
      await clearPrimaryCustomerWidePerType(tx, {
        tenantId: input.tenantId,
        customerId: input.customerId,
        type: input.type,
      });
    }
    const row = await tx.customerContactMethod.create({
      data: {
        contactId: input.contactId,
        type: input.type,
        value,
        isPrimary,
        okToSms,
        okToEmail,
      },
      select: {
        id: true,
        type: true,
        value: true,
        isPrimary: true,
        okToSms: true,
        okToEmail: true,
      },
    });
    return row;
  });
}

export async function updateCustomerContactMethodForTenant(
  prisma: PrismaClient,
  input: UpdateCustomerContactMethodInput,
): Promise<CustomerContactMethodMutationDto | "not_found"> {
  const contact = await loadActiveContactForTenant(prisma, input);
  if (!contact) return "not_found";

  const method = await prisma.customerContactMethod.findFirst({
    where: { id: input.methodId, contactId: input.contactId },
    select: { id: true, type: true },
  });
  if (!method) return "not_found";

  const nextValue =
    input.value !== undefined ? assertMethodValue(method.type, input.value) : undefined;

  return prisma.$transaction(async (tx) => {
    if (input.isPrimary === true) {
      await clearPrimaryCustomerWidePerType(
        tx,
        { tenantId: input.tenantId, customerId: input.customerId, type: method.type },
        method.id,
      );
    }

    const row = await tx.customerContactMethod.update({
      where: { id: method.id },
      data: {
        ...(nextValue !== undefined ? { value: nextValue } : {}),
        ...(input.isPrimary !== undefined ? { isPrimary: input.isPrimary } : {}),
        ...(input.okToSms !== undefined ? { okToSms: input.okToSms } : {}),
        ...(input.okToEmail !== undefined ? { okToEmail: input.okToEmail } : {}),
      },
      select: {
        id: true,
        type: true,
        value: true,
        isPrimary: true,
        okToSms: true,
        okToEmail: true,
      },
    });
    return row;
  });
}

export async function deleteCustomerContactMethodForTenant(
  prisma: PrismaClient,
  params: { tenantId: string; customerId: string; contactId: string; methodId: string },
): Promise<"deleted" | "not_found"> {
  const contact = await loadActiveContactForTenant(prisma, params);
  if (!contact) return "not_found";

  const method = await prisma.customerContactMethod.findFirst({
    where: { id: params.methodId, contactId: params.contactId },
    select: { id: true },
  });
  if (!method) return "not_found";

  await prisma.customerContactMethod.delete({ where: { id: method.id } });
  return "deleted";
}
