-- Epic 01 minimal Lead + optional Quote.leadId (conversion-first MVP schema slice).
-- No backfill: existing Quote rows keep leadId NULL.

CREATE TYPE "LeadStatus" AS ENUM ('OPEN', 'ON_HOLD', 'NURTURE', 'LOST', 'ARCHIVED', 'CONVERTED');

CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'OPEN',
    "source" TEXT,
    "primaryEmail" TEXT,
    "primaryPhone" TEXT,
    "summary" TEXT,
    "assignedToUserId" TEXT,
    "createdById" TEXT NOT NULL,
    "lostReason" TEXT,
    "convertedAt" TIMESTAMP(3),
    "convertedCustomerId" TEXT,
    "convertedFlowGroupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Lead_tenantId_idx" ON "Lead"("tenantId");
CREATE INDEX "Lead_tenantId_status_idx" ON "Lead"("tenantId", "status");
CREATE INDEX "Lead_tenantId_assignedToUserId_idx" ON "Lead"("tenantId", "assignedToUserId");
CREATE INDEX "Lead_tenantId_createdAt_idx" ON "Lead"("tenantId", "createdAt");

ALTER TABLE "Lead" ADD CONSTRAINT "Lead_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_convertedCustomerId_fkey" FOREIGN KEY ("convertedCustomerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_convertedFlowGroupId_fkey" FOREIGN KEY ("convertedFlowGroupId") REFERENCES "FlowGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Quote" ADD COLUMN "leadId" TEXT;

CREATE INDEX "Quote_tenantId_leadId_idx" ON "Quote"("tenantId", "leadId");

ALTER TABLE "Quote" ADD CONSTRAINT "Quote_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
