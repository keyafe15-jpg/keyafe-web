-- CreateEnum
CREATE TYPE "OfflineDiscountType" AS ENUM ('FLAT', 'PERCENT');

-- AlterTable
ALTER TABLE "OrderLink" ADD COLUMN "discountType" "OfflineDiscountType",
ADD COLUMN "discountValue" DECIMAL(10, 2);
