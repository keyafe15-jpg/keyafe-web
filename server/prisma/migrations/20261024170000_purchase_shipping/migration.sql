-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN "shipping" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Move courier lines onto the buy, then drop them from the item catalog.
UPDATE "Purchase" p
SET "shipping" = sub.amt
FROM (
  SELECT pl."purchaseId" AS id, SUM(pl.amount)::DECIMAL(10,2) AS amt
  FROM "PurchaseLine" pl
  INNER JOIN "BuyItem" bi ON bi.id = pl."buyItemId"
  WHERE bi."nameNormalized" LIKE '%shipping%'
     OR bi."nameNormalized" IN ('delivery charge', 'delivery charges', 'delhivery')
  GROUP BY pl."purchaseId"
) sub
WHERE p.id = sub.id;

DELETE FROM "PurchaseLine" pl
USING "BuyItem" bi
WHERE pl."buyItemId" = bi.id
  AND (
    bi."nameNormalized" LIKE '%shipping%'
    OR bi."nameNormalized" IN ('delivery charge', 'delivery charges', 'delhivery')
  );

UPDATE "BuyItem"
SET "isActive" = false, "archivedAt" = CURRENT_TIMESTAMP
WHERE (
  "nameNormalized" LIKE '%shipping%'
  OR "nameNormalized" IN ('delivery charge', 'delivery charges', 'delhivery')
);
