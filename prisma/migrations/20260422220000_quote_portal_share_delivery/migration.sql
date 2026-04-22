-- Epic 54 follow-up: office quote portal link delivery + audit for regenerate.

DO $$ BEGIN
  ALTER TYPE "AuditEventType" ADD VALUE 'QUOTE_PORTAL_SHARE_DELIVERED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "AuditEventType" ADD VALUE 'QUOTE_PORTAL_LINK_REGENERATED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE "QuotePortalShareDelivery" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "quoteVersionId" TEXT NOT NULL,
    "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredById" TEXT NOT NULL,
    "deliveryMethod" "PublicShareDeliveryMethod" NOT NULL,
    "recipientDetail" TEXT,
    "shareToken" TEXT NOT NULL,
    "providerStatus" "PublicShareDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "providerExternalId" TEXT,
    "providerError" TEXT,
    "providerResponse" JSONB,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "isFollowUp" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "QuotePortalShareDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "QuotePortalShareDelivery_tenantId_idx" ON "QuotePortalShareDelivery"("tenantId");
CREATE INDEX "QuotePortalShareDelivery_quoteVersionId_idx" ON "QuotePortalShareDelivery"("quoteVersionId");

ALTER TABLE "QuotePortalShareDelivery" ADD CONSTRAINT "QuotePortalShareDelivery_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuotePortalShareDelivery" ADD CONSTRAINT "QuotePortalShareDelivery_quoteVersionId_fkey" FOREIGN KEY ("quoteVersionId") REFERENCES "QuoteVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuotePortalShareDelivery" ADD CONSTRAINT "QuotePortalShareDelivery_deliveredById_fkey" FOREIGN KEY ("deliveredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
