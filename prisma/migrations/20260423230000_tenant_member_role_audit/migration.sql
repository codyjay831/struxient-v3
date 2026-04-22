-- Epic 59 — audit trail for tenant member role updates.

ALTER TYPE "AuditEventType" ADD VALUE 'TENANT_MEMBER_ROLE_UPDATED';
