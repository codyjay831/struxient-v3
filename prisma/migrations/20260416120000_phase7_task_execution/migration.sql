-- Phase 7 slice: append-only TaskExecution for RUNTIME tasks (canon/04, epic 41).

-- CreateEnum
CREATE TYPE "TaskExecutionTaskKind" AS ENUM ('RUNTIME', 'SKELETON');

-- CreateEnum
CREATE TYPE "TaskExecutionEventType" AS ENUM ('STARTED', 'COMPLETED');

-- CreateTable
CREATE TABLE "TaskExecution" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "taskKind" "TaskExecutionTaskKind" NOT NULL,
    "runtimeTaskId" TEXT,
    "skeletonTaskId" TEXT,
    "eventType" "TaskExecutionEventType" NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskExecution_tenantId_flowId_idx" ON "TaskExecution"("tenantId", "flowId");

-- CreateIndex
CREATE INDEX "TaskExecution_flowId_createdAt_idx" ON "TaskExecution"("flowId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TaskExecution_runtimeTaskId_eventType_key" ON "TaskExecution"("runtimeTaskId", "eventType");

-- AddForeignKey
ALTER TABLE "TaskExecution" ADD CONSTRAINT "TaskExecution_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskExecution" ADD CONSTRAINT "TaskExecution_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "Flow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskExecution" ADD CONSTRAINT "TaskExecution_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskExecution" ADD CONSTRAINT "TaskExecution_runtimeTaskId_fkey" FOREIGN KEY ("runtimeTaskId") REFERENCES "RuntimeTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
