-- Normalize legacy rows: at most one primary per (customerId, method type) for the whole customer.
-- Only touches (customerId, type) pairs that had at least one isPrimary=true.
-- Prefer an active contact's primary over archived; then lowest method id.
WITH primaries AS (
  SELECT m.id,
    cc."customerId",
    m.type,
    ROW_NUMBER() OVER (
      PARTITION BY cc."customerId", m.type
      ORDER BY (CASE WHEN cc."archivedAt" IS NULL THEN 0 ELSE 1 END), m.id ASC
    ) AS rk
  FROM "CustomerContactMethod" m
  INNER JOIN "CustomerContact" cc ON cc.id = m."contactId"
  WHERE m."isPrimary" = true
),
keep AS (SELECT id FROM primaries WHERE rk = 1),
scope AS (SELECT DISTINCT "customerId", type FROM primaries)
UPDATE "CustomerContactMethod" m
SET "isPrimary" = m.id IN (SELECT id FROM keep)
FROM "CustomerContact" cc
WHERE m."contactId" = cc.id
  AND (cc."customerId", m.type) IN (SELECT "customerId", type FROM scope);
