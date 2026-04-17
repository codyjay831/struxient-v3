-- Data backfill: align DBs seeded before compose-preview with current seed.js JSON.
-- Targets only the exact prior smoke-seed shapes (empty workflow nodes + stub packet embed).

UPDATE "WorkflowVersion"
SET "snapshotJson" = '{"nodes":[{"id":"node-roof"}]}'::jsonb
WHERE "snapshotJson" = '{"nodes":[]}'::jsonb;

UPDATE "PacketTaskLine"
SET "embeddedPayloadJson" = '{"targetNodeKey":"node-roof","title":"Catalog task","taskKind":"LABOR"}'::jsonb
WHERE "embeddedPayloadJson" = '{"stub":true}'::jsonb;
