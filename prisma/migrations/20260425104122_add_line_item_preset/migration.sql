-- CreateTable
CREATE TABLE "LineItemPreset" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "presetKey" TEXT,
    "displayName" TEXT NOT NULL,
    "defaultTitle" TEXT,
    "defaultDescription" TEXT,
    "defaultQuantity" INTEGER,
    "defaultUnitPriceCents" INTEGER,
    "defaultExecutionMode" "QuoteLineItemExecutionMode" NOT NULL,
    "defaultPaymentBeforeWork" BOOLEAN,
    "defaultPaymentGateTitleOverride" TEXT,
    "defaultScopePacketId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LineItemPreset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LineItemPreset_tenantId_idx" ON "LineItemPreset"("tenantId");

-- CreateIndex
CREATE INDEX "LineItemPreset_defaultScopePacketId_idx" ON "LineItemPreset"("defaultScopePacketId");

-- CreateIndex
CREATE UNIQUE INDEX "LineItemPreset_tenantId_presetKey_key" ON "LineItemPreset"("tenantId", "presetKey");

-- AddForeignKey
ALTER TABLE "LineItemPreset" ADD CONSTRAINT "LineItemPreset_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineItemPreset" ADD CONSTRAINT "LineItemPreset_defaultScopePacketId_fkey" FOREIGN KEY ("defaultScopePacketId") REFERENCES "ScopePacket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
