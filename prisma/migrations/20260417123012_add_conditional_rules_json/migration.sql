-- AlterTable
ALTER TABLE "RuntimeTask" ADD COLUMN     "conditionalRulesJson" JSONB;

-- AlterTable
ALTER TABLE "TaskDefinition" ADD COLUMN     "conditionalRulesJson" JSONB;
