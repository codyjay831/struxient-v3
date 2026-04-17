-- Phase 5 slice: Job anchor at sign + QuoteSignature + SIGNED status (decisions/04-job-anchor-timing-decision.md)

-- AlterEnum
ALTER TYPE "QuoteVersionStatus" ADD VALUE 'SIGNED';

-- AlterEnum
ALTER TYPE "AuditEventType" ADD VALUE 'QUOTE_VERSION_SIGNED';

-- CreateEnum
CREATE TYPE "QuoteSignatureMethod" AS ENUM ('OFFICE_RECORDED');

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "flowGroupId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteSignature" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "quoteVersionId" TEXT NOT NULL,
    "method" "QuoteSignatureMethod" NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" TEXT NOT NULL,

    CONSTRAINT "QuoteSignature_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "QuoteVersion" ADD COLUMN     "signedAt" TIMESTAMP(3),
ADD COLUMN     "signedById" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Job_flowGroupId_key" ON "Job"("flowGroupId");

-- CreateIndex
CREATE INDEX "Job_tenantId_idx" ON "Job"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteSignature_quoteVersionId_key" ON "QuoteSignature"("quoteVersionId");

-- CreateIndex
CREATE INDEX "QuoteSignature_tenantId_idx" ON "QuoteSignature"("tenantId");

-- CreateIndex
CREATE INDEX "QuoteVersion_signedById_idx" ON "QuoteVersion"("signedById");

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_flowGroupId_fkey" FOREIGN KEY ("flowGroupId") REFERENCES "FlowGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteSignature" ADD CONSTRAINT "QuoteSignature_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteSignature" ADD CONSTRAINT "QuoteSignature_quoteVersionId_fkey" FOREIGN KEY ("quoteVersionId") REFERENCES "QuoteVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteSignature" ADD CONSTRAINT "QuoteSignature_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteVersion" ADD CONSTRAINT "QuoteVersion_signedById_fkey" FOREIGN KEY ("signedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
