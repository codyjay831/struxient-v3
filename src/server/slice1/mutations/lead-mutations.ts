import type { LeadStatus, PrismaClient } from "@prisma/client";
import {
  assertLeadStatusTransitionAllowed,
  isLeadContentImmutable,
  LEAD_DISPLAY_NAME_MAX,
  LEAD_EMAIL_MAX,
  LEAD_LOST_REASON_MAX,
  LEAD_PHONE_MAX,
  LEAD_SOURCE_MAX,
  LEAD_SUMMARY_MAX,
} from "../invariants/lead";

function trimOrNull(raw: string | null | undefined, max: number): string | null {
  if (raw == null) return null;
  const t = raw.trim();
  if (t.length === 0) return null;
  if (t.length > max) return null;
  return t;
}

function requireDisplayName(raw: string): string | null {
  const t = raw.trim();
  if (t.length === 0 || t.length > LEAD_DISPLAY_NAME_MAX) return null;
  return t;
}

async function assertUserInTenant(
  prisma: PrismaClient,
  params: { tenantId: string; userId: string },
): Promise<boolean> {
  const u = await prisma.user.findFirst({
    where: { id: params.userId, tenantId: params.tenantId },
    select: { id: true },
  });
  return u != null;
}

export type CreateLeadForTenantInput = {
  displayName: string;
  source?: string | null;
  primaryEmail?: string | null;
  primaryPhone?: string | null;
  summary?: string | null;
  assignedToUserId?: string | null;
};

export type CreateLeadForTenantResult =
  | { ok: true; data: { id: string } }
  | { ok: false; kind: "display_name_invalid" | "field_too_long" | "assignee_not_in_tenant" | "created_by_not_in_tenant" };

export async function createLeadForTenant(
  prisma: PrismaClient,
  params: { tenantId: string; createdByUserId: string; input: CreateLeadForTenantInput },
): Promise<CreateLeadForTenantResult> {
  const displayName = requireDisplayName(params.input.displayName);
  if (!displayName) {
    return { ok: false, kind: "display_name_invalid" };
  }
  const source = trimOrNull(params.input.source ?? null, LEAD_SOURCE_MAX);
  if (params.input.source != null && params.input.source !== "" && source === null) {
    return { ok: false, kind: "field_too_long" };
  }
  const primaryEmail = trimOrNull(params.input.primaryEmail ?? null, LEAD_EMAIL_MAX);
  if (params.input.primaryEmail != null && params.input.primaryEmail !== "" && primaryEmail === null) {
    return { ok: false, kind: "field_too_long" };
  }
  const primaryPhone = trimOrNull(params.input.primaryPhone ?? null, LEAD_PHONE_MAX);
  if (params.input.primaryPhone != null && params.input.primaryPhone !== "" && primaryPhone === null) {
    return { ok: false, kind: "field_too_long" };
  }
  const summary = trimOrNull(params.input.summary ?? null, LEAD_SUMMARY_MAX);
  if (params.input.summary != null && params.input.summary !== "" && summary === null) {
    return { ok: false, kind: "field_too_long" };
  }

  if (!(await assertUserInTenant(prisma, { tenantId: params.tenantId, userId: params.createdByUserId }))) {
    return { ok: false, kind: "created_by_not_in_tenant" };
  }

  const assignedToUserId = params.input.assignedToUserId?.trim() ?? null;
  if (assignedToUserId) {
    if (!(await assertUserInTenant(prisma, { tenantId: params.tenantId, userId: assignedToUserId }))) {
      return { ok: false, kind: "assignee_not_in_tenant" };
    }
  }

  const row = await prisma.lead.create({
    data: {
      tenantId: params.tenantId,
      displayName,
      status: "OPEN",
      source,
      primaryEmail,
      primaryPhone,
      summary,
      assignedToUserId: assignedToUserId || null,
      createdById: params.createdByUserId,
    },
    select: { id: true },
  });
  return { ok: true, data: { id: row.id } };
}

export type UpdateLeadForTenantInput = {
  displayName?: string;
  source?: string | null;
  primaryEmail?: string | null;
  primaryPhone?: string | null;
  summary?: string | null;
  assignedToUserId?: string | null;
};

export type UpdateLeadForTenantResult =
  | { ok: true }
  | {
      ok: false;
      kind:
        | "lead_not_found"
        | "lead_immutable"
        | "display_name_invalid"
        | "field_too_long"
        | "assignee_not_in_tenant"
        | "no_changes";
    };

export async function updateLeadForTenant(
  prisma: PrismaClient,
  params: { tenantId: string; leadId: string; input: UpdateLeadForTenantInput },
): Promise<UpdateLeadForTenantResult> {
  const existing = await prisma.lead.findFirst({
    where: { id: params.leadId, tenantId: params.tenantId },
    select: { id: true, status: true },
  });
  if (!existing) {
    return { ok: false, kind: "lead_not_found" };
  }
  if (isLeadContentImmutable(existing.status)) {
    return { ok: false, kind: "lead_immutable" };
  }

  const data: {
    displayName?: string;
    source?: string | null;
    primaryEmail?: string | null;
    primaryPhone?: string | null;
    summary?: string | null;
    assignedToUserId?: string | null;
  } = {};
  if (params.input.displayName !== undefined) {
    const d = requireDisplayName(params.input.displayName);
    if (!d) return { ok: false, kind: "display_name_invalid" };
    data.displayName = d;
  }
  if (params.input.source !== undefined) {
    const s = trimOrNull(params.input.source, LEAD_SOURCE_MAX);
    if (params.input.source != null && params.input.source !== "" && s === null) {
      return { ok: false, kind: "field_too_long" };
    }
    data.source = s;
  }
  if (params.input.primaryEmail !== undefined) {
    const e = trimOrNull(params.input.primaryEmail, LEAD_EMAIL_MAX);
    if (params.input.primaryEmail != null && params.input.primaryEmail !== "" && e === null) {
      return { ok: false, kind: "field_too_long" };
    }
    data.primaryEmail = e;
  }
  if (params.input.primaryPhone !== undefined) {
    const p = trimOrNull(params.input.primaryPhone, LEAD_PHONE_MAX);
    if (params.input.primaryPhone != null && params.input.primaryPhone !== "" && p === null) {
      return { ok: false, kind: "field_too_long" };
    }
    data.primaryPhone = p;
  }
  if (params.input.summary !== undefined) {
    const sum = trimOrNull(params.input.summary, LEAD_SUMMARY_MAX);
    if (params.input.summary != null && params.input.summary !== "" && sum === null) {
      return { ok: false, kind: "field_too_long" };
    }
    data.summary = sum;
  }
  if (params.input.assignedToUserId !== undefined) {
    const aid = params.input.assignedToUserId?.trim() ?? "";
    if (aid.length > 0) {
      if (!(await assertUserInTenant(prisma, { tenantId: params.tenantId, userId: aid }))) {
        return { ok: false, kind: "assignee_not_in_tenant" };
      }
      data.assignedToUserId = aid;
    } else {
      data.assignedToUserId = null;
    }
  }

  if (Object.keys(data).length === 0) {
    return { ok: false, kind: "no_changes" };
  }

  await prisma.lead.update({
    where: { id: params.leadId },
    data,
  });
  return { ok: true };
}

export type SetLeadStatusForTenantInput = {
  nextStatus: LeadStatus;
  lostReason?: string | null;
};

export type SetLeadStatusForTenantResult =
  | { ok: true }
  | {
      ok: false;
      kind:
        | "lead_not_found"
        | "lead_immutable"
        | "invalid_status_transition"
        | "cannot_set_converted_via_status"
        | "lost_reason_too_long";
    };

export async function setLeadStatusForTenant(
  prisma: PrismaClient,
  params: { tenantId: string; leadId: string; input: SetLeadStatusForTenantInput },
): Promise<SetLeadStatusForTenantResult> {
  const existing = await prisma.lead.findFirst({
    where: { id: params.leadId, tenantId: params.tenantId },
    select: { id: true, status: true },
  });
  if (!existing) {
    return { ok: false, kind: "lead_not_found" };
  }
  if (existing.status === "CONVERTED") {
    return { ok: false, kind: "lead_immutable" };
  }

  const transition = assertLeadStatusTransitionAllowed({
    from: existing.status,
    to: params.input.nextStatus,
  });
  if (!transition.ok) {
    return { ok: false, kind: transition.kind };
  }

  let lostReason: string | null = null;
  if (params.input.nextStatus === "LOST") {
    lostReason = trimOrNull(params.input.lostReason ?? null, LEAD_LOST_REASON_MAX);
    if (params.input.lostReason != null && params.input.lostReason !== "" && lostReason === null) {
      return { ok: false, kind: "lost_reason_too_long" };
    }
  }

  await prisma.lead.update({
    where: { id: params.leadId },
    data: {
      status: params.input.nextStatus,
      lostReason: params.input.nextStatus === "LOST" ? lostReason : null,
    },
  });
  return { ok: true };
}
