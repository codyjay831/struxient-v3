-- Phase 6 slice: Flow + Activation + RuntimeTask from frozen execution package (epics 33, 35; canon/03).

-- AlterEnum
ALTER TYPE "AuditEventType" ADD VALUE 'QUOTE_VERSION_ACTIVATED';

-- CreateTable
CREATE TABLE "Flow" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "workflowVersionId" TEXT NOT NULL,
    "quoteVersionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Flow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "quoteVersionId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "packageSnapshotSha256" TEXT NOT NULL,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedById" TEXT NOT NULL,

    CONSTRAINT "Activation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuntimeTask" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "packageTaskId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "quoteVersionId" TEXT NOT NULL,
    "lineItemId" TEXT NOT NULL,
    "planTaskIds" JSONB NOT NULL,
    "displayTitle" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RuntimeTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Flow_quoteVersionId_key" ON "Flow"("quoteVersionId");

-- CreateIndex
CREATE INDEX "Flow_tenantId_idx" ON "Flow"("tenantId");

-- CreateIndex
CREATE INDEX "Flow_jobId_idx" ON "Flow"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "Activation_quoteVersionId_key" ON "Activation"("quoteVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "Activation_flowId_key" ON "Activation"("flowId");

-- CreateIndex
CREATE INDEX "Activation_tenantId_idx" ON "Activation"("tenantId");

-- CreateIndex
CREATE INDEX "Activation_jobId_idx" ON "Activation"("jobId");

-- CreateIndex
CREATE INDEX "RuntimeTask_tenantId_idx" ON "RuntimeTask"("tenantId");

-- CreateIndex
CREATE INDEX "RuntimeTask_flowId_idx" ON "RuntimeTask"("flowId");

-- CreateIndex
CREATE UNIQUE INDEX "RuntimeTask_flowId_packageTaskId_key" ON "RuntimeTask"("flowId", "packageTaskId");

-- AddForeignKey
ALTER TABLE "Flow" ADD CONSTRAINT "Flow_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flow" ADD CONSTRAINT "Flow_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flow" ADD CONSTRAINT "Flow_workflowVersionId_fkey" FOREIGN KEY ("workflowVersionId") REFERENCES "WorkflowVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flow" ADD CONSTRAINT "Flow_quoteVersionId_fkey" FOREIGN KEY ("quoteVersionId") REFERENCES "QuoteVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activation" ADD CONSTRAINT "Activation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activation" ADD CONSTRAINT "Activation_quoteVersionId_fkey" FOREIGN KEY ("quoteVersionId") REFERENCES "QuoteVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activation" ADD CONSTRAINT "Activation_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activation" ADD CONSTRAINT "Activation_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "Flow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activation" ADD CONSTRAINT "Activation_activatedById_fkey" FOREIGN KEY ("activatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuntimeTask" ADD CONSTRAINT "RuntimeTask_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuntimeTask" ADD CONSTRAINT "RuntimeTask_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "Flow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuntimeTask" ADD CONSTRAINT "RuntimeTask_quoteVersionId_fkey" FOREIGN KEY ("quoteVersionId") REFERENCES "QuoteVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
