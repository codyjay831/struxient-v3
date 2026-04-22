-- Epic 57 — customer-scoped audit anchor + CRM lifecycle event types.

ALTER TABLE "AuditEvent" ADD COLUMN "targetCustomerId" TEXT;

CREATE INDEX "AuditEvent_tenantId_targetCustomerId_createdAt_idx" ON "AuditEvent" ("tenantId", "targetCustomerId", "createdAt");

ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_targetCustomerId_fkey" FOREIGN KEY ("targetCustomerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TYPE "AuditEventType" ADD VALUE 'CUSTOMER_NOTE_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE 'CUSTOMER_NOTE_UPDATED';
ALTER TYPE "AuditEventType" ADD VALUE 'CUSTOMER_NOTE_ARCHIVED';
ALTER TYPE "AuditEventType" ADD VALUE 'CUSTOMER_CONTACT_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE 'CUSTOMER_CONTACT_UPDATED';
ALTER TYPE "AuditEventType" ADD VALUE 'CUSTOMER_CONTACT_ARCHIVED';
ALTER TYPE "AuditEventType" ADD VALUE 'CUSTOMER_CONTACT_METHOD_CHANGED';
