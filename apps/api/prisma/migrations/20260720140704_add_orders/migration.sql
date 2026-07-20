-- CreateEnum
CREATE TYPE "ServiceTier" AS ENUM ('SCHEDULED', 'PRIORITY', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "Complexity" AS ENUM ('SIMPLE', 'MEDIUM', 'COMPLEX', 'CRITICAL');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'PRICED', 'SEARCHING', 'ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS', 'COMPLETED', 'CLOSED', 'CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_MASTER', 'EXPIRED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "OrderMediaKind" AS ENUM ('PHOTO', 'VIDEO');

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "orderNo" SERIAL NOT NULL,
    "customerId" UUID NOT NULL,
    "categoryId" UUID,
    "description" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "serviceTier" "ServiceTier" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledAt" TIMESTAMP(3),
    "addressText" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "complexity" "Complexity",
    "aiDiagnosis" JSONB,
    "priceMin" INTEGER,
    "priceMax" INTEGER,
    "platformFee" INTEGER NOT NULL DEFAULT 0,
    "consentAcceptedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_media" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "kind" "OrderMediaKind" NOT NULL,
    "objectKey" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_status_history" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "fromStatus" "OrderStatus",
    "toStatus" "OrderStatus" NOT NULL,
    "actorId" UUID,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "orders_orderNo_key" ON "orders"("orderNo");

-- CreateIndex
CREATE INDEX "orders_customerId_createdAt_idx" ON "orders"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "order_media_orderId_idx" ON "order_media"("orderId");

-- CreateIndex
CREATE INDEX "order_status_history_orderId_createdAt_idx" ON "order_status_history"("orderId", "createdAt");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "service_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_media" ADD CONSTRAINT "order_media_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
