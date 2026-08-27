-- CreateEnum
CREATE TYPE "OrderLinkKind" AS ENUM ('CUSTOM', 'CATALOG');

-- CreateEnum
CREATE TYPE "OrderLinkStatus" AS ENUM ('OPEN', 'ORDERED', 'EXPIRED', 'CANCELLED');

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "referenceImageUrl" TEXT,
ALTER COLUMN "productId" DROP NOT NULL,
ALTER COLUMN "productSlug" DROP NOT NULL;

-- CreateTable
CREATE TABLE "OrderLink" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "kind" "OrderLinkKind" NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "sizeLabel" TEXT,
    "sizeGrams" INTEGER,
    "flavourId" TEXT,
    "flavourName" TEXT,
    "referenceImageUrl" TEXT,
    "messageHint" TEXT,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "suggestedDate" TIMESTAMP(3),
    "suggestedSlotKey" TEXT,
    "suggestedSlotLabel" TEXT,
    "adminNotes" TEXT,
    "status" "OrderLinkStatus" NOT NULL DEFAULT 'OPEN',
    "expiresAt" TIMESTAMP(3),
    "linkedOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrderLink_token_key" ON "OrderLink"("token");

-- CreateIndex
CREATE UNIQUE INDEX "OrderLink_linkedOrderId_key" ON "OrderLink"("linkedOrderId");

-- CreateIndex
CREATE INDEX "OrderLink_status_createdAt_idx" ON "OrderLink"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "OrderLink" ADD CONSTRAINT "OrderLink_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLink" ADD CONSTRAINT "OrderLink_linkedOrderId_fkey" FOREIGN KEY ("linkedOrderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
