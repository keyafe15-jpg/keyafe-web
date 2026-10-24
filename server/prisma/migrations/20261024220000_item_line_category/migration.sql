-- AlterTable
ALTER TABLE "BuyItem" ADD COLUMN "categoryId" TEXT;

-- AlterTable
ALTER TABLE "PurchaseLine" ADD COLUMN "categoryId" TEXT;

-- Copy each buy’s expense category onto its lines.
UPDATE "PurchaseLine" pl
SET "categoryId" = e."categoryId"
FROM "Expense" e
WHERE e."purchaseId" = pl."purchaseId"
  AND pl."categoryId" IS NULL;

-- Lines with no linked expense land on raw materials.
UPDATE "PurchaseLine" pl
SET "categoryId" = (SELECT id FROM "ExpenseCategory" WHERE slug = 'raw-materials' LIMIT 1)
WHERE pl."categoryId" IS NULL;

-- Catalog default: most recent line, else raw materials.
UPDATE "BuyItem" bi
SET "categoryId" = sub."categoryId"
FROM (
  SELECT DISTINCT ON (pl."buyItemId")
    pl."buyItemId",
    pl."categoryId"
  FROM "PurchaseLine" pl
  INNER JOIN "Purchase" p ON p.id = pl."purchaseId"
  ORDER BY pl."buyItemId", p.date DESC, pl.id DESC
) sub
WHERE bi.id = sub."buyItemId"
  AND bi."categoryId" IS NULL;

UPDATE "BuyItem" bi
SET "categoryId" = (SELECT id FROM "ExpenseCategory" WHERE slug = 'raw-materials' LIMIT 1)
WHERE bi."categoryId" IS NULL;

ALTER TABLE "PurchaseLine" ALTER COLUMN "categoryId" SET NOT NULL;

CREATE INDEX "BuyItem_categoryId_idx" ON "BuyItem"("categoryId");
CREATE INDEX "PurchaseLine_categoryId_idx" ON "PurchaseLine"("categoryId");

ALTER TABLE "BuyItem" ADD CONSTRAINT "BuyItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PurchaseLine" ADD CONSTRAINT "PurchaseLine_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
