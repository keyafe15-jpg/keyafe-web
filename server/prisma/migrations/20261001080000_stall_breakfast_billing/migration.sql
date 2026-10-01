-- AlterEnum
ALTER TYPE "OrderSource" ADD VALUE 'STALL_BILL';

-- AlterTable
ALTER TABLE "Stall" ADD COLUMN     "billToAddress" JSONB,
ADD COLUMN     "billToEmail" TEXT,
ADD COLUMN     "billToGstin" TEXT,
ADD COLUMN     "billToName" TEXT,
ADD COLUMN     "billToPhone" TEXT;

-- CreateTable
CREATE TABLE "StallBreakfast" (
    "id" TEXT NOT NULL,
    "stallId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "plates" INTEGER NOT NULL,
    "platePrice" DECIMAL(10,2) NOT NULL,
    "items" TEXT NOT NULL,
    "note" TEXT,
    "orderId" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StallBreakfast_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StallBreakfast_stallId_date_idx" ON "StallBreakfast"("stallId", "date");

-- CreateIndex
CREATE INDEX "StallBreakfast_orderId_idx" ON "StallBreakfast"("orderId");

-- AddForeignKey
ALTER TABLE "StallBreakfast" ADD CONSTRAINT "StallBreakfast_stallId_fkey" FOREIGN KEY ("stallId") REFERENCES "Stall"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StallBreakfast" ADD CONSTRAINT "StallBreakfast_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
