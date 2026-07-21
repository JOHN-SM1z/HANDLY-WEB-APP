-- Enable PostGIS (idempotent) — required for the geography columns below.
-- The docker-compose Postgres image already has it on the real dev DB; this
-- also covers Prisma's shadow DB and any fresh database migrations replay onto.
CREATE EXTENSION IF NOT EXISTS postgis;

-- CreateEnum
CREATE TYPE "DispatchStatus" AS ENUM ('OFFERED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('OFFER_RECEIVED', 'OFFER_EXPIRED', 'ORDER_ASSIGNED', 'ORDER_SEARCH_FAILED');

-- AlterTable
ALTER TABLE "master_profiles" ADD COLUMN     "isOnline" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "onlineSince" TIMESTAMP(3);

-- AlterTable
-- "location" is a generated column (kept in sync by Postgres from
-- latitude/longitude — never written by the app/Prisma) so dispatch's
-- PostGIS radius/distance queries have an indexable geography value.
ALTER TABLE "orders" ADD COLUMN     "location" geography(Point, 4326) GENERATED ALWAYS AS (
  CASE WHEN "latitude" IS NOT NULL AND "longitude" IS NOT NULL
    THEN ST_SetSRID(ST_MakePoint("longitude"::double precision, "latitude"::double precision), 4326)::geography
    ELSE NULL
  END
) STORED,
ADD COLUMN     "masterId" UUID;

-- AlterTable
-- Same generated-column pattern as orders.location, from centerLat/centerLng
-- (both required on ServiceArea, so no NULL case needed).
ALTER TABLE "service_areas" ADD COLUMN     "centerPoint" geography(Point, 4326) GENERATED ALWAYS AS (
  ST_SetSRID(ST_MakePoint("centerLng"::double precision, "centerLat"::double precision), 4326)::geography
) STORED;

-- CreateTable
CREATE TABLE "order_dispatches" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "masterId" UUID NOT NULL,
    "rankInCascade" INTEGER NOT NULL,
    "distanceM" INTEGER NOT NULL,
    "score" DECIMAL(6,2) NOT NULL,
    "status" "DispatchStatus" NOT NULL DEFAULT 'OFFERED',
    "countedAsLead" BOOLEAN NOT NULL DEFAULT false,
    "offeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_dispatches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_dispatches_orderId_idx" ON "order_dispatches"("orderId");

-- CreateIndex
CREATE INDEX "order_dispatches_masterId_status_idx" ON "order_dispatches"("masterId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "order_dispatches_orderId_masterId_key" ON "order_dispatches"("orderId", "masterId");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "master_profiles_isOnline_idx" ON "master_profiles"("isOnline");

-- CreateIndex
CREATE INDEX "orders_masterId_idx" ON "orders"("masterId");

-- CreateIndex (spatial — dispatch's ST_DWithin/ST_Distance queries)
CREATE INDEX "orders_location_gist" ON "orders" USING GIST ("location");

-- CreateIndex (spatial)
CREATE INDEX "service_areas_center_point_gist" ON "service_areas" USING GIST ("centerPoint");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "master_profiles"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_dispatches" ADD CONSTRAINT "order_dispatches_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_dispatches" ADD CONSTRAINT "order_dispatches_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "master_profiles"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
