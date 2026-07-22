-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'PAYMENT_RESOLVED';

-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'REFUNDED';

-- AlterTable
ALTER TABLE "master_profiles" ADD COLUMN     "avatarUrl" TEXT;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "resolutionNote" TEXT,
ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "resolvedByAdminId" UUID;

-- Note: the DROP INDEX/ALTER COLUMN DROP DEFAULT statements Prisma generated
-- for orders.location/service_areas.centerPoint were hand-stripped here — a
-- recurring shadow-DB diff artifact for these two PostGIS generated columns,
-- not a real schema change. See docs/runbooks/migration-checklist.md.
