-- AlterTable
ALTER TABLE "StallSale" ADD COLUMN     "dueAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "dueFrom" TEXT,
ADD COLUMN     "duePaidAt" TIMESTAMP(3),
ADD COLUMN     "duePaidByName" TEXT;
