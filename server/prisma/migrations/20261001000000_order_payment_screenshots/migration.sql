-- AlterTable
ALTER TABLE "Order" ADD COLUMN "paymentScreenshotUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Carry each order's single screenshot over to the new list.
UPDATE "Order"
SET "paymentScreenshotUrls" = ARRAY["paymentScreenshotUrl"]
WHERE "paymentScreenshotUrl" IS NOT NULL;
