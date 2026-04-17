-- CreateEnum
CREATE TYPE "TenantMemberRole" AS ENUM ('OFFICE_ADMIN', 'FIELD_WORKER', 'READ_ONLY');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "passwordHash" TEXT,
ADD COLUMN     "role" "TenantMemberRole" NOT NULL DEFAULT 'OFFICE_ADMIN';
