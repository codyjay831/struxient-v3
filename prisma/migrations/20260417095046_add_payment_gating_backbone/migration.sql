-- CreateEnum
CREATE TYPE "PaymentGateStatus" AS ENUM ('UNSATISFIED', 'SATISFIED');

-- CreateTable
CREATE TABLE "PaymentGate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "quoteVersionId" TEXT NOT NULL,
    "status" "PaymentGateStatus" NOT NULL DEFAULT 'UNSATISFIED',
    "title" TEXT NOT NULL,
    "satisfiedAt" TIMESTAMP(3),
    "satisfiedById" TEXT,

    CONSTRAINT "PaymentGate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentGateTarget" (
    "id" TEXT NOT NULL,
    "paymentGateId" TEXT NOT NULL,
    "taskKind" "TaskExecutionTaskKind" NOT NULL,
    "taskId" TEXT NOT NULL,

    CONSTRAINT "PaymentGateTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentGate_quoteVersionId_key" ON "PaymentGate"("quoteVersionId");

-- CreateIndex
CREATE INDEX "PaymentGate_tenantId_idx" ON "PaymentGate"("tenantId");

-- CreateIndex
CREATE INDEX "PaymentGate_jobId_idx" ON "PaymentGate"("jobId");

-- CreateIndex
CREATE INDEX "PaymentGateTarget_paymentGateId_idx" ON "PaymentGateTarget"("paymentGateId");

-- CreateIndex
CREATE INDEX "PaymentGateTarget_taskId_idx" ON "PaymentGateTarget"("taskId");

-- AddForeignKey
ALTER TABLE "PaymentGate" ADD CONSTRAINT "PaymentGate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentGate" ADD CONSTRAINT "PaymentGate_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentGate" ADD CONSTRAINT "PaymentGate_quoteVersionId_fkey" FOREIGN KEY ("quoteVersionId") REFERENCES "QuoteVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentGate" ADD CONSTRAINT "PaymentGate_satisfiedById_fkey" FOREIGN KEY ("satisfiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentGateTarget" ADD CONSTRAINT "PaymentGateTarget_paymentGateId_fkey" FOREIGN KEY ("paymentGateId") REFERENCES "PaymentGate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
