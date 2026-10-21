-- Extra reference photos on custom order / link lines (first stays in referenceImageUrl).
ALTER TABLE "OrderItem" ADD COLUMN "referenceImageUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "OrderLinkItem" ADD COLUMN "referenceImageUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "OrderItem"
SET "referenceImageUrls" = ARRAY["referenceImageUrl"]
WHERE "referenceImageUrl" IS NOT NULL AND "referenceImageUrl" <> '';

UPDATE "OrderLinkItem"
SET "referenceImageUrls" = ARRAY["referenceImageUrl"]
WHERE "referenceImageUrl" IS NOT NULL AND "referenceImageUrl" <> '';
