-- AlterTable
ALTER TABLE "master_media" ADD COLUMN     "mime" TEXT;

-- Note: the DROP INDEX/ALTER COLUMN DROP DEFAULT statements Prisma generated
-- for orders.location/service_areas.centerPoint were hand-stripped here — see
-- docs/runbooks/migration-checklist.md (same recurring shadow-DB diff
-- artifact for these two PostGIS generated columns, not a real change).
