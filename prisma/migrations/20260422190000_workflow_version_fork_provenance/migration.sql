-- AlterTable
ALTER TABLE "WorkflowVersion" ADD COLUMN "forkedFromWorkflowVersionId" TEXT;

-- CreateIndex
CREATE INDEX "WorkflowVersion_forkedFromWorkflowVersionId_idx" ON "WorkflowVersion"("forkedFromWorkflowVersionId");

-- AddForeignKey
ALTER TABLE "WorkflowVersion" ADD CONSTRAINT "WorkflowVersion_forkedFromWorkflowVersionId_fkey" FOREIGN KEY ("forkedFromWorkflowVersionId") REFERENCES "WorkflowVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
