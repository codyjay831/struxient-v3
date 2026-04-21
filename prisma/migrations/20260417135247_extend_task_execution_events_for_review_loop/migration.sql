-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TaskExecutionEventType" ADD VALUE 'REVIEW_ACCEPTED';
ALTER TYPE "TaskExecutionEventType" ADD VALUE 'CORRECTION_REQUIRED';

-- DropIndex
DROP INDEX "TaskExecution_runtimeTaskId_eventType_key";

-- CreateIndex
CREATE INDEX "TaskExecution_runtimeTaskId_idx" ON "TaskExecution"("runtimeTaskId");
