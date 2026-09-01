-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('FULL', 'ADVANCE');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paymentMode" "PaymentMode" NOT NULL DEFAULT 'FULL',
ADD COLUMN     "paymentScreenshotUrl" TEXT;
