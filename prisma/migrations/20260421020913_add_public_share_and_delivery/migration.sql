-- CreateEnum
CREATE TYPE "PublicShareDeliveryMethod" AS ENUM ('EMAIL', 'SMS', 'MANUAL_LINK');

-- CreateEnum
CREATE TYPE "PublicShareDeliveryStatus" AS ENUM ('QUEUED', 'SENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "PublicShareStatus" AS ENUM ('UNPUBLISHED', 'PUBLISHED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEventType" ADD VALUE 'FLOW_SHARE_MANAGED';
ALTER TYPE "AuditEventType" ADD VALUE 'FLOW_SHARE_DELIVERED';
ALTER TYPE "AuditEventType" ADD VALUE 'PROJECT_SHARE_DELIVERED';
ALTER TYPE "AuditEventType" ADD VALUE 'PROJECT_SHARE_MANAGED';

-- AlterTable
ALTER TABLE "AuditEvent" ADD COLUMN     "targetFlowId" TEXT,
ALTER COLUMN "actorId" DROP NOT NULL,
ALTER COLUMN "targetQuoteVersionId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "primaryEmail" TEXT,
ADD COLUMN     "primaryPhone" TEXT;

-- AlterTable
ALTER TABLE "Flow" ADD COLUMN     "publicShareClarificationReason" TEXT,
ADD COLUMN     "publicShareClarificationRequestedAt" TIMESTAMP(3),
ADD COLUMN     "publicShareClarificationResolutionNote" TEXT,
ADD COLUMN     "publicShareClarificationResolvedAt" TIMESTAMP(3),
ADD COLUMN     "publicShareExpiresAt" TIMESTAMP(3),
ADD COLUMN     "publicShareFirstViewedAt" TIMESTAMP(3),
ADD COLUMN     "publicShareLastFollowUpSentAt" TIMESTAMP(3),
ADD COLUMN     "publicShareLastViewedAt" TIMESTAMP(3),
ADD COLUMN     "publicShareNotificationLastSeenAt" TIMESTAMP(3),
ADD COLUMN     "publicShareReceiptAcknowledgedAt" TIMESTAMP(3),
ADD COLUMN     "publicShareStatus" "PublicShareStatus" NOT NULL DEFAULT 'UNPUBLISHED',
ADD COLUMN     "publicShareToken" TEXT,
ADD COLUMN     "publicShareTokenGeneratedAt" TIMESTAMP(3),
ADD COLUMN     "publicShareViewCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "FlowGroup" ADD COLUMN     "publicShareClarificationEscalatedAt" TIMESTAMP(3),
ADD COLUMN     "publicShareClarificationReason" TEXT,
ADD COLUMN     "publicShareClarificationRequestedAt" TIMESTAMP(3),
ADD COLUMN     "publicShareClarificationResolutionNote" TEXT,
ADD COLUMN     "publicShareClarificationResolvedAt" TIMESTAMP(3),
ADD COLUMN     "publicShareExpiresAt" TIMESTAMP(3),
ADD COLUMN     "publicShareFirstViewedAt" TIMESTAMP(3),
ADD COLUMN     "publicShareLastViewedAt" TIMESTAMP(3),
ADD COLUMN     "publicShareNotificationLastSeenAt" TIMESTAMP(3),
ADD COLUMN     "publicShareReceiptAcknowledgedAt" TIMESTAMP(3),
ADD COLUMN     "publicShareStatus" "PublicShareStatus" NOT NULL DEFAULT 'UNPUBLISHED',
ADD COLUMN     "publicShareToken" TEXT,
ADD COLUMN     "publicShareTokenGeneratedAt" TIMESTAMP(3),
ADD COLUMN     "publicShareViewCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "FlowShareDelivery" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredById" TEXT NOT NULL,
    "deliveryMethod" "PublicShareDeliveryMethod" NOT NULL,
    "recipientDetail" TEXT,
    "shareToken" TEXT NOT NULL,
    "providerStatus" "PublicShareDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "providerExternalId" TEXT,
    "providerError" TEXT,
    "providerResponse" JSONB,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "isFollowUp" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "FlowShareDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectShareDelivery" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "flowGroupId" TEXT NOT NULL,
    "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredById" TEXT NOT NULL,
    "deliveryMethod" "PublicShareDeliveryMethod" NOT NULL,
    "recipientDetail" TEXT,
    "shareToken" TEXT NOT NULL,
    "providerStatus" "PublicShareDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "providerExternalId" TEXT,
    "providerError" TEXT,
    "providerResponse" JSONB,
    "retryCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProjectShareDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FlowShareDelivery_tenantId_idx" ON "FlowShareDelivery"("tenantId");

-- CreateIndex
CREATE INDEX "FlowShareDelivery_flowId_idx" ON "FlowShareDelivery"("flowId");

-- CreateIndex
CREATE INDEX "ProjectShareDelivery_tenantId_idx" ON "ProjectShareDelivery"("tenantId");

-- CreateIndex
CREATE INDEX "ProjectShareDelivery_flowGroupId_idx" ON "ProjectShareDelivery"("flowGroupId");

-- CreateIndex
CREATE INDEX "AuditEvent_targetFlowId_idx" ON "AuditEvent"("targetFlowId");

-- CreateIndex
CREATE UNIQUE INDEX "Flow_publicShareToken_key" ON "Flow"("publicShareToken");

-- CreateIndex
CREATE UNIQUE INDEX "FlowGroup_publicShareToken_key" ON "FlowGroup"("publicShareToken");

-- AddForeignKey
ALTER TABLE "FlowShareDelivery" ADD CONSTRAINT "FlowShareDelivery_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlowShareDelivery" ADD CONSTRAINT "FlowShareDelivery_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "Flow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlowShareDelivery" ADD CONSTRAINT "FlowShareDelivery_deliveredById_fkey" FOREIGN KEY ("deliveredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_targetFlowId_fkey" FOREIGN KEY ("targetFlowId") REFERENCES "Flow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectShareDelivery" ADD CONSTRAINT "ProjectShareDelivery_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectShareDelivery" ADD CONSTRAINT "ProjectShareDelivery_flowGroupId_fkey" FOREIGN KEY ("flowGroupId") REFERENCES "FlowGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectShareDelivery" ADD CONSTRAINT "ProjectShareDelivery_deliveredById_fkey" FOREIGN KEY ("deliveredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

