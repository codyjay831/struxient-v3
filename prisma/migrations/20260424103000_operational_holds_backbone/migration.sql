-- Epic 29 / 48 — durable operational holds (separate from PaymentGate).

CREATE TYPE "HoldStatus" AS ENUM ('ACTIVE', 'RELEASED');
CREATE TYPE "HoldType" AS ENUM ('OPERATIONAL_CUSTOM');

CREATE TABLE "Hold" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "runtimeTaskId" TEXT,
    "holdType" "HoldType" NOT NULL DEFAULT 'OPERATIONAL_CUSTOM',
    "status" "HoldStatus" NOT NULL DEFAULT 'ACTIVE',
    "reason" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),
    "releasedById" TEXT,

    CONSTRAINT "Hold_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Hold_tenantId_jobId_status_idx" ON "Hold"("tenantId", "jobId", "status");
CREATE INDEX "Hold_tenantId_runtimeTaskId_status_idx" ON "Hold"("tenantId", "runtimeTaskId", "status");

ALTER TABLE "Hold" ADD CONSTRAINT "Hold_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Hold" ADD CONSTRAINT "Hold_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Hold" ADD CONSTRAINT "Hold_runtimeTaskId_fkey" FOREIGN KEY ("runtimeTaskId") REFERENCES "RuntimeTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Hold" ADD CONSTRAINT "Hold_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Hold" ADD CONSTRAINT "Hold_releasedById_fkey" FOREIGN KEY ("releasedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
