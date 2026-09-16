-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "customerCompanyName" TEXT,
ADD COLUMN     "customerGstin" TEXT,
ADD COLUMN     "invoiceDate" TIMESTAMP(3),
ADD COLUMN     "invoiceNumber" TEXT,
ADD COLUMN     "placeOfSupply" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "cgstAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "gstRate" DECIMAL(5,2),
ADD COLUMN     "hsnCode" TEXT,
ADD COLUMN     "igstAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "sgstAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "taxableValue" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "InvoiceCounter" (
    "series" TEXT NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceCounter_pkey" PRIMARY KEY ("series")
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_invoiceNumber_key" ON "Order"("invoiceNumber");
