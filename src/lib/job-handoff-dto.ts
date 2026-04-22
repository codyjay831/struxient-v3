import type { JobHandoffReadRow } from "@/server/slice1/reads/job-handoff-reads";

export type JobHandoffApiDto = {
  id: string;
  jobId: string;
  quoteVersionId: string;
  status: "DRAFT" | "SENT" | "ACKNOWLEDGED";
  briefingNotes: string | null;
  assignedUserIds: string[];
  createdByUserId: string;
  createdByLabel: string | null;
  sentAt: string | null;
  sentByUserId: string | null;
  sentByLabel: string | null;
  acknowledgedAt: string | null;
  acknowledgedByUserId: string | null;
  acknowledgedByLabel: string | null;
  createdAt: string;
  updatedAt: string;
};

export function toJobHandoffApiDto(row: JobHandoffReadRow): JobHandoffApiDto {
  return {
    id: row.id,
    jobId: row.jobId,
    quoteVersionId: row.quoteVersionId,
    status: row.status,
    briefingNotes: row.briefingNotes,
    assignedUserIds: [...row.assignedUserIds],
    createdByUserId: row.createdByUserId,
    createdByLabel: row.createdByLabel,
    sentAt: row.sentAt?.toISOString() ?? null,
    sentByUserId: row.sentByUserId,
    sentByLabel: row.sentByLabel,
    acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
    acknowledgedByUserId: row.acknowledgedByUserId,
    acknowledgedByLabel: row.acknowledgedByLabel,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
