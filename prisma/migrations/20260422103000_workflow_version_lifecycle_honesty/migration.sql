-- Epic 23 foundation: honest draft/publish lifecycle for WorkflowVersion.
-- - DRAFT rows may have publishedAt = NULL (previously NOT NULL forced a fake timestamp).
-- - SUPERSEDED supports a future publish path that demotes the prior PUBLISHED sibling.
--
-- Existing PUBLISHED rows keep their publishedAt; NOT NULL is dropped only at the column level.

ALTER TYPE "WorkflowVersionStatus" ADD VALUE IF NOT EXISTS 'SUPERSEDED';

ALTER TABLE "WorkflowVersion" ALTER COLUMN "publishedAt" DROP NOT NULL;
