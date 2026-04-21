-- AlterTable
ALTER TABLE "PacketTaskLine" ADD COLUMN     "taskDefinitionId" TEXT;

-- AlterTable
ALTER TABLE "TaskDefinition" ADD COLUMN     "completionRequirementsJson" JSONB,
ADD COLUMN     "instructions" TEXT;

-- AddForeignKey
ALTER TABLE "PacketTaskLine" ADD CONSTRAINT "PacketTaskLine_taskDefinitionId_fkey" FOREIGN KEY ("taskDefinitionId") REFERENCES "TaskDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
