-- CreateEnum
CREATE TYPE "CustomerContactRole" AS ENUM ('BILLING', 'SITE', 'OWNER', 'OTHER');

CREATE TYPE "CustomerContactMethodType" AS ENUM ('EMAIL', 'PHONE', 'MOBILE', 'OTHER');

-- CreateTable
CREATE TABLE "CustomerContact" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "CustomerContactRole",
    "notes" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerContact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerContactMethod" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "type" "CustomerContactMethodType" NOT NULL,
    "value" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "okToSms" BOOLEAN NOT NULL DEFAULT false,
    "okToEmail" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerContactMethod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerContact_tenantId_customerId_idx" ON "CustomerContact"("tenantId", "customerId");

CREATE INDEX "CustomerContact_customerId_idx" ON "CustomerContact"("customerId");

CREATE INDEX "CustomerContactMethod_contactId_idx" ON "CustomerContactMethod"("contactId");

-- AddForeignKey
ALTER TABLE "CustomerContact" ADD CONSTRAINT "CustomerContact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CustomerContact" ADD CONSTRAINT "CustomerContact_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CustomerContactMethod" ADD CONSTRAINT "CustomerContactMethod_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CustomerContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
