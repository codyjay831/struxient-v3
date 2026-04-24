-- AlterEnum
ALTER TYPE "QuoteVersionStatus" ADD VALUE 'DECLINED';

-- AlterEnum
ALTER TYPE "AuditEventType" ADD VALUE 'QUOTE_VERSION_DECLINED_PORTAL';

-- AlterTable
ALTER TABLE "QuoteVersion" ADD COLUMN "portalDeclinedAt" TIMESTAMP(3),
ADD COLUMN "portalDeclineReason" TEXT;
