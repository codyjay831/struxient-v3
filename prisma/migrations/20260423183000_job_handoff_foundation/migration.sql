-- Epic 44 — office-to-field handoff foundation (durable record + send + acknowledge + audit).

CREATE TYPE "JobHandoffStatus" AS ENUM ('DRAFT', 'SENT', 'ACKNOWLEDGED');

CREATE TABLE "JobHandoff" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "quoteVersionId" TEXT NOT NULL,
    "status" "JobHandoffStatus" NOT NULL DEFAULT 'DRAFT',
    "briefingNotes" TEXT,
    "assignedUserIds" JSONB NOT NULL DEFAULT '[]',
    "createdByUserId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "sentByUserId" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobHandoff_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "JobHandoff_jobId_key" ON "JobHandoff"("jobId");

CREATE INDEX "JobHandoff_tenantId_idx" ON "JobHandoff"("tenantId");

CREATE INDEX "JobHandoff_tenantId_status_idx" ON "JobHandoff"("tenantId", "status");

ALTER TABLE "JobHandoff" ADD CONSTRAINT "JobHandoff_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "JobHandoff" ADD CONSTRAINT "JobHandoff_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JobHandoff" ADD CONSTRAINT "JobHandoff_quoteVersionId_fkey" FOREIGN KEY ("quoteVersionId") REFERENCES "QuoteVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "JobHandoff" ADD CONSTRAINT "JobHandoff_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "JobHandoff" ADD CONSTRAINT "JobHandoff_sentByUserId_fkey" FOREIGN KEY ("sentByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "JobHandoff" ADD CONSTRAINT "JobHandoff_acknowledgedByUserId_fkey" FOREIGN KEY ("acknowledgedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TYPE "AuditEventType" ADD VALUE 'JOB_HANDOFF_SENT';
ALTER TYPE "AuditEventType" ADD VALUE 'JOB_HANDOFF_ACKNOWLEDGED';
