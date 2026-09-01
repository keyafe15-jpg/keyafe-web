/*
  Warnings:

  - Splits the single-item `OrderLink` into a parent `OrderLink` +
    child `OrderLinkItem` rows (one link can now hold multiple items).
    Existing single-item rows are migrated into one OrderLinkItem each
    before the old columns are dropped — no data loss.

*/
-- CreateTable
CREATE TABLE "OrderLinkItem" (
    "id" TEXT NOT NULL,
    "orderLinkId" TEXT NOT NULL,
    "kind" "OrderLinkKind" NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "sizeLabel" TEXT,
    "sizeGrams" INTEGER,
    "flavourId" TEXT,
    "flavourName" TEXT,
    "referenceImageUrl" TEXT,
    "messageHint" TEXT,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderLinkItem_pkey" PRIMARY KEY ("id")
);

-- Backfill: one OrderLinkItem per existing OrderLink row, from its old columns.
INSERT INTO "OrderLinkItem" (
    "id", "orderLinkId", "kind", "productId", "productName", "sizeLabel",
    "sizeGrams", "flavourId", "flavourName", "referenceImageUrl", "messageHint",
    "unitPrice", "qty", "sortOrder", "createdAt"
)
SELECT
    'oli_' || "id", "id", "kind", "productId", "productName", "sizeLabel",
    "sizeGrams", "flavourId", "flavourName", "referenceImageUrl", "messageHint",
    "unitPrice", "qty", 0, "createdAt"
FROM "OrderLink";

-- DropForeignKey
ALTER TABLE "OrderLink" DROP CONSTRAINT "OrderLink_productId_fkey";

-- AlterTable
ALTER TABLE "OrderLink" DROP COLUMN "flavourId",
DROP COLUMN "flavourName",
DROP COLUMN "kind",
DROP COLUMN "messageHint",
DROP COLUMN "productId",
DROP COLUMN "productName",
DROP COLUMN "qty",
DROP COLUMN "referenceImageUrl",
DROP COLUMN "sizeGrams",
DROP COLUMN "sizeLabel",
DROP COLUMN "unitPrice";

-- CreateIndex
CREATE INDEX "OrderLinkItem_orderLinkId_idx" ON "OrderLinkItem"("orderLinkId");

-- AddForeignKey
ALTER TABLE "OrderLinkItem" ADD CONSTRAINT "OrderLinkItem_orderLinkId_fkey" FOREIGN KEY ("orderLinkId") REFERENCES "OrderLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLinkItem" ADD CONSTRAINT "OrderLinkItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
