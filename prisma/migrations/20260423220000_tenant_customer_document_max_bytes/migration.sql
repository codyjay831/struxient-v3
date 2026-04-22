-- Epic 60 — tenant-level cap for customer office document uploads (bytes).

ALTER TABLE "Tenant" ADD COLUMN "customerDocumentMaxBytes" INTEGER NOT NULL DEFAULT 20971520;

ALTER TYPE "AuditEventType" ADD VALUE 'TENANT_OPERATIONAL_SETTINGS_UPDATED';
