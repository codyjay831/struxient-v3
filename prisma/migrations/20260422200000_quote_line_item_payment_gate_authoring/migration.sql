-- Epic 47: commercial authoring for payment gate intent (frozen at send).

ALTER TABLE "QuoteLineItem" ADD COLUMN "paymentBeforeWork" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "QuoteLineItem" ADD COLUMN "paymentGateTitleOverride" TEXT;
