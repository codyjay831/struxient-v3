-- Canon-authorized schema change for the revision-2 evolution epic.
-- Authority:
--   docs/canon/05-packet-canon.md ("Canon amendment — revision-2 evolution policy (post-publish)")
--   docs/implementation/decision-packs/revision-2-evolution-decision-pack.md §9
--
-- Single change: add SUPERSEDED to ScopePacketRevisionStatus.
--
-- Postgres requires a new enum value to be committed before it can be used by
-- subsequent updates. Prisma migrate runs each migration outside of the user
-- transaction, so the publish writer's later
-- `UPDATE ... SET status = 'SUPERSEDED'` runs against an already-committed
-- enum. No other schema changes (no ScopePacket.status, no PacketTier, no
-- audit columns, no new tables, no new indexes).

ALTER TYPE "ScopePacketRevisionStatus" ADD VALUE IF NOT EXISTS 'SUPERSEDED';
