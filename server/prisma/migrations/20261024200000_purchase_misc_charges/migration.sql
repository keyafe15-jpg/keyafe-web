-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN "miscCharges" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Fold handling / packing-fee / platform-style lines into misc, then drop them.
UPDATE "Purchase" p
SET "miscCharges" = sub.amt,
    "total" = p."total"
FROM (
  SELECT pl."purchaseId" AS id, SUM(pl.amount)::DECIMAL(10,2) AS amt
  FROM "PurchaseLine" pl
  INNER JOIN "BuyItem" bi ON bi.id = pl."buyItemId"
  WHERE bi."nameNormalized" LIKE '%handling%'
     OR bi."nameNormalized" LIKE '%convenience%'
     OR bi."nameNormalized" LIKE '%platform fee%'
     OR bi."nameNormalized" LIKE '%platform charge%'
     OR bi."nameNormalized" LIKE '%service charge%'
     OR bi."nameNormalized" LIKE '%service fee%'
     OR bi."nameNormalized" LIKE '%processing%'
     OR bi."nameNormalized" LIKE '%surcharge%'
     OR bi."nameNormalized" LIKE '%packing charge%'
     OR bi."nameNormalized" LIKE '%packing fee%'
     OR bi."nameNormalized" LIKE '%packaging charge%'
     OR bi."nameNormalized" LIKE '%packaging fee%'
     OR bi."nameNormalized" LIKE '%extra charge%'
     OR bi."nameNormalized" LIKE '%other charge%'
     OR bi."nameNormalized" LIKE '%miscellaneous%'
     OR bi."nameNormalized" LIKE '%misc charge%'
  GROUP BY pl."purchaseId"
) sub
WHERE p.id = sub.id;

UPDATE "Purchase" p
SET "total" = p."total"
WHERE p."miscCharges" > 0;

DELETE FROM "PurchaseLine" pl
USING "BuyItem" bi
WHERE pl."buyItemId" = bi.id
  AND (
    bi."nameNormalized" LIKE '%handling%'
    OR bi."nameNormalized" LIKE '%convenience%'
    OR bi."nameNormalized" LIKE '%platform fee%'
    OR bi."nameNormalized" LIKE '%platform charge%'
    OR bi."nameNormalized" LIKE '%service charge%'
    OR bi."nameNormalized" LIKE '%service fee%'
    OR bi."nameNormalized" LIKE '%processing%'
    OR bi."nameNormalized" LIKE '%surcharge%'
    OR bi."nameNormalized" LIKE '%packing charge%'
    OR bi."nameNormalized" LIKE '%packing fee%'
    OR bi."nameNormalized" LIKE '%packaging charge%'
    OR bi."nameNormalized" LIKE '%packaging fee%'
    OR bi."nameNormalized" LIKE '%extra charge%'
    OR bi."nameNormalized" LIKE '%other charge%'
    OR bi."nameNormalized" LIKE '%miscellaneous%'
    OR bi."nameNormalized" LIKE '%misc charge%'
  );

-- Totals after folding: goods remaining + shipping + misc.
UPDATE "Purchase" p
SET "total" = COALESCE(goods.amt, 0) + p.shipping + p."miscCharges"
FROM (
  SELECT "purchaseId" AS id, SUM(amount)::DECIMAL(10,2) AS amt
  FROM "PurchaseLine"
  GROUP BY "purchaseId"
) goods
WHERE p.id = goods.id;

UPDATE "Purchase" p
SET "total" = p.shipping + p."miscCharges"
WHERE NOT EXISTS (SELECT 1 FROM "PurchaseLine" pl WHERE pl."purchaseId" = p.id);

UPDATE "Expense" e
SET amount = p.total
FROM "Purchase" p
WHERE e."purchaseId" = p.id
  AND e."voidedAt" IS NULL;

UPDATE "BuyItem"
SET "isActive" = false, "archivedAt" = CURRENT_TIMESTAMP
WHERE "isActive" = true
  AND (
    "nameNormalized" LIKE '%handling%'
    OR "nameNormalized" LIKE '%convenience%'
    OR "nameNormalized" LIKE '%platform fee%'
    OR "nameNormalized" LIKE '%platform charge%'
    OR "nameNormalized" LIKE '%service charge%'
    OR "nameNormalized" LIKE '%service fee%'
    OR "nameNormalized" LIKE '%processing%'
    OR "nameNormalized" LIKE '%surcharge%'
    OR "nameNormalized" LIKE '%packing charge%'
    OR "nameNormalized" LIKE '%packing fee%'
    OR "nameNormalized" LIKE '%packaging charge%'
    OR "nameNormalized" LIKE '%packaging fee%'
    OR "nameNormalized" LIKE '%extra charge%'
    OR "nameNormalized" LIKE '%other charge%'
    OR "nameNormalized" LIKE '%miscellaneous%'
    OR "nameNormalized" LIKE '%misc charge%'
  );
