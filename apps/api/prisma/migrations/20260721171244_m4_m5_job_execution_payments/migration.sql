-- CreateEnum
CREATE TYPE "OrderMediaUploader" AS ENUM ('CUSTOMER', 'MASTER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CLICK', 'PAYME', 'UZUM', 'MOCK');

-- AlterTable
ALTER TABLE "order_media" ADD COLUMN     "uploadedByRole" "OrderMediaUploader" NOT NULL DEFAULT 'CUSTOMER';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "finalAmount" INTEGER;

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amount" INTEGER NOT NULL,
    "platformFee" INTEGER NOT NULL,
    "taxRate" DECIMAL(5,4) NOT NULL,
    "taxAmount" INTEGER NOT NULL,
    "masterNetAmount" INTEGER NOT NULL,
    "taxWithholdingRef" TEXT,
    "providerRef" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "succeededAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payments_providerRef_key" ON "payments"("providerRef");

-- CreateIndex
CREATE INDEX "payments_orderId_idx" ON "payments"("orderId");

-- CreateIndex
CREATE INDEX "payments_customerId_createdAt_idx" ON "payments"("customerId", "createdAt");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
