-- Epic 06 — customer-scoped office documents (durable row + storage key; not task evidence).

CREATE TYPE "CustomerDocumentCategory" AS ENUM ('DOCUMENT', 'IMAGE', 'OTHER');

CREATE TYPE "CustomerDocumentStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

CREATE TABLE "CustomerDocument" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "category" "CustomerDocumentCategory" NOT NULL DEFAULT 'OTHER',
    "caption" TEXT,
    "status" "CustomerDocumentStatus" NOT NULL DEFAULT 'ACTIVE',
    "archivedAt" TIMESTAMP(3),
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerDocument_storageKey_key" ON "CustomerDocument"("storageKey");

CREATE INDEX "CustomerDocument_tenantId_customerId_idx" ON "CustomerDocument"("tenantId", "customerId");

CREATE INDEX "CustomerDocument_customerId_createdAt_idx" ON "CustomerDocument"("customerId", "createdAt");

ALTER TABLE "CustomerDocument" ADD CONSTRAINT "CustomerDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CustomerDocument" ADD CONSTRAINT "CustomerDocument_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CustomerDocument" ADD CONSTRAINT "CustomerDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TYPE "AuditEventType" ADD VALUE 'CUSTOMER_DOCUMENT_UPLOADED';

ALTER TYPE "AuditEventType" ADD VALUE 'CUSTOMER_DOCUMENT_ARCHIVED';
