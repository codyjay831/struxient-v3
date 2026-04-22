-- Epic 54: customer portal quote review link + durable portal signature method.

DO $$ BEGIN
  ALTER TYPE "QuoteSignatureMethod" ADD VALUE 'CUSTOMER_PORTAL_ACCEPTED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "QuoteVersion" ADD COLUMN "portalQuoteShareToken" TEXT;
CREATE UNIQUE INDEX "QuoteVersion_portalQuoteShareToken_key" ON "QuoteVersion"("portalQuoteShareToken");

ALTER TABLE "QuoteSignature" ALTER COLUMN "recordedById" DROP NOT NULL;
ALTER TABLE "QuoteSignature" ADD COLUMN "portalSignerLabel" TEXT;
ALTER TABLE "QuoteSignature" ADD COLUMN "portalAcceptPayloadJson" JSONB;
