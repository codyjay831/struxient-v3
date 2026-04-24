-- AlterEnum
ALTER TYPE "AuditEventType" ADD VALUE 'QUOTE_VERSION_CHANGE_REQUESTED_PORTAL';

-- AlterTable
ALTER TABLE "QuoteVersion" ADD COLUMN "portalChangeRequestedAt" TIMESTAMP(3),
ADD COLUMN "portalChangeRequestMessage" TEXT;
