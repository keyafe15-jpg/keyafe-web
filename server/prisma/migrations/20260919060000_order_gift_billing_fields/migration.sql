-- AlterTable
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "recipientName" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryPhone" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "billingAddress" JSONB;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "isSurpriseGift" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: delivery phone = buyer phone; billing = delivery when present
UPDATE "Order"
SET "deliveryPhone" = "customerPhone"
WHERE "fulfillment" = 'DELIVERY' AND ("deliveryPhone" IS NULL OR "deliveryPhone" = '');

UPDATE "Order"
SET "billingAddress" = "deliveryAddress"
WHERE "billingAddress" IS NULL AND "deliveryAddress" IS NOT NULL;
