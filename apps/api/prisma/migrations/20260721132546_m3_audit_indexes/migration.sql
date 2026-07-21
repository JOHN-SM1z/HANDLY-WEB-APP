-- Hand-edited: Prisma's diff engine doesn't fully understand the
-- Unsupported("geography(Point, 4326)") generated columns (orders.location,
-- service_areas.centerPoint) and tried to DROP+recreate their GIST indexes
-- via an invalid `ALTER COLUMN ... DROP DEFAULT` on a GENERATED ALWAYS AS
-- STORED column (which Postgres rejects — see the M3 migration's own note
-- about the same Unsupported-type limitation). Neither generated column nor
-- its GIST index is actually changing here — only the two indexes below are.

-- DropIndex
DROP INDEX "orders_masterId_idx";

-- CreateIndex
CREATE INDEX "orders_masterId_status_idx" ON "orders"("masterId", "status");

-- CreateIndex
CREATE INDEX "sessions_refreshTokenHash_idx" ON "sessions"("refreshTokenHash");
