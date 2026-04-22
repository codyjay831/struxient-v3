import type { PrismaClient } from "@prisma/client";

export type JobHandoffReadRow = {
  id: string;
  jobId: string;
  quoteVersionId: string;
  status: "DRAFT" | "SENT" | "ACKNOWLEDGED";
  briefingNotes: string | null;
  assignedUserIds: string[];
  createdByUserId: string;
  createdByLabel: string | null;
  sentAt: Date | null;
  sentByUserId: string | null;
  sentByLabel: string | null;
  acknowledgedAt: Date | null;
  acknowledgedByUserId: string | null;
  acknowledgedByLabel: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function userLabel(u: { displayName: string | null; email: string } | null): string | null {
  if (!u) return null;
  const d = u.displayName?.trim();
  return d && d.length > 0 ? d : u.email;
}

export function parseAssignedUserIdsJson(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim());
}

export async function getJobHandoffForTenant(
  prisma: PrismaClient,
  params: { tenantId: string; jobId: string },
): Promise<JobHandoffReadRow | null> {
  const row = await prisma.jobHandoff.findFirst({
    where: { jobId: params.jobId, tenantId: params.tenantId },
    select: {
      id: true,
      jobId: true,
      quoteVersionId: true,
      status: true,
      briefingNotes: true,
      assignedUserIds: true,
      createdByUserId: true,
      sentAt: true,
      sentByUserId: true,
      acknowledgedAt: true,
      acknowledgedByUserId: true,
      createdAt: true,
      updatedAt: true,
      createdBy: { select: { displayName: true, email: true } },
      sentBy: { select: { displayName: true, email: true } },
      acknowledgedBy: { select: { displayName: true, email: true } },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    jobId: row.jobId,
    quoteVersionId: row.quoteVersionId,
    status: row.status,
    briefingNotes: row.briefingNotes,
    assignedUserIds: parseAssignedUserIdsJson(row.assignedUserIds),
    createdByUserId: row.createdByUserId,
    createdByLabel: userLabel(row.createdBy),
    sentAt: row.sentAt,
    sentByUserId: row.sentByUserId,
    sentByLabel: userLabel(row.sentBy),
    acknowledgedAt: row.acknowledgedAt,
    acknowledgedByUserId: row.acknowledgedByUserId,
    acknowledgedByLabel: userLabel(row.acknowledgedBy),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
