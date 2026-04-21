-- AlterTable
ALTER TABLE "CompletionProof" ADD COLUMN     "checklistJson" JSONB,
ADD COLUMN     "identifiersJson" JSONB,
ADD COLUMN     "measurementsJson" JSONB,
ADD COLUMN     "overallResult" TEXT;
