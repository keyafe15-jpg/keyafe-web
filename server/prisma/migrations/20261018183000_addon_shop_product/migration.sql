-- Standalone shop listing for each add-on (candles, toppers, etc.).
ALTER TABLE "Addon" ADD COLUMN "productId" TEXT;

CREATE UNIQUE INDEX "Addon_productId_key" ON "Addon"("productId");

ALTER TABLE "Addon" ADD CONSTRAINT "Addon_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
