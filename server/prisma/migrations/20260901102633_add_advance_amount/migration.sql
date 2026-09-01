-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'PARTIAL';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "advanceAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;
