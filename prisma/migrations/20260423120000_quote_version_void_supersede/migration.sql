-- Epic 14: quote version void + supersede (pre-activation lifecycle).

DO $$ BEGIN
  ALTER TYPE "QuoteVersionStatus" ADD VALUE 'VOID';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "QuoteVersionStatus" ADD VALUE 'SUPERSEDED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "AuditEventType" ADD VALUE 'QUOTE_VERSION_VOIDED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "AuditEventType" ADD VALUE 'QUOTE_VERSION_SUPERSEDED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "QuoteVersion" ADD COLUMN "voidedAt" TIMESTAMP(3);
ALTER TABLE "QuoteVersion" ADD COLUMN "voidedById" TEXT;
ALTER TABLE "QuoteVersion" ADD COLUMN "voidReason" TEXT;

DO $$ BEGIN
  ALTER TABLE "QuoteVersion" ADD CONSTRAINT "QuoteVersion_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
