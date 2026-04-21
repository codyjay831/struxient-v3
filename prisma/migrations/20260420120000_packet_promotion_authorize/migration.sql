-- Canon-authorized schema changes for the interim one-step promotion flow.
-- Authority:
--   docs/canon/05-packet-canon.md (Canon amendment — interim one-step promotion)
--   docs/implementation/decision-packs/interim-packet-promotion-decision-pack.md §6
--   docs/epics/16-packet-task-lines-epic.md §6 + §16a
--
-- Two scoped changes:
--   1. ScopePacketRevision.publishedAt → nullable
--      (DRAFT revisions produced by the interim promotion flow have publishedAt = NULL;
--       PUBLISHED revisions still set it; service layer enforces the conditional).
--   2. PacketTaskLine.targetNodeKey → top-level NOT NULL String
--      (mirrors QuoteLocalPacketItem.targetNodeKey to enable 1:1 promotion mapping;
--       legacy rows are backfilled from embeddedPayloadJson->>'targetNodeKey' when present).

-- 1. Relax NOT NULL on ScopePacketRevision.publishedAt
ALTER TABLE "ScopePacketRevision" ALTER COLUMN "publishedAt" DROP NOT NULL;

-- 2a. Add PacketTaskLine.targetNodeKey as nullable so we can backfill before tightening.
ALTER TABLE "PacketTaskLine" ADD COLUMN "targetNodeKey" TEXT;

-- 2b. Backfill from embeddedPayloadJson when the legacy shape carried it inline.
UPDATE "PacketTaskLine"
SET "targetNodeKey" = "embeddedPayloadJson"->>'targetNodeKey'
WHERE "targetNodeKey" IS NULL
  AND "embeddedPayloadJson" ? 'targetNodeKey'
  AND jsonb_typeof("embeddedPayloadJson"->'targetNodeKey') = 'string';

-- 2c. Defensive sentinel for any pre-existing row that did not encode targetNodeKey
-- in the embedded payload. The compose engine's legacy fallback still treats this as
-- a missing target and emits PACKAGE_BIND_FAILED, matching pre-migration behavior.
UPDATE "PacketTaskLine"
SET "targetNodeKey" = '__missing__'
WHERE "targetNodeKey" IS NULL OR "targetNodeKey" = '';

-- 2d. Tighten to NOT NULL.
ALTER TABLE "PacketTaskLine" ALTER COLUMN "targetNodeKey" SET NOT NULL;
