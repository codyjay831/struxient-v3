-- Tenant policy: optional chained activation on sign (same transaction in app code).

ALTER TABLE "Tenant" ADD COLUMN "autoActivateOnSign" BOOLEAN NOT NULL DEFAULT false;
