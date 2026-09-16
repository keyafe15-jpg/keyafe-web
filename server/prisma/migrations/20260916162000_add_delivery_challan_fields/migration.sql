-- AlterTable
ALTER TABLE "BusinessSettings" ADD COLUMN     "challanTerms" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "challanDate" TIMESTAMP(3),
ADD COLUMN     "challanNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_challanNumber_key" ON "Order"("challanNumber");

