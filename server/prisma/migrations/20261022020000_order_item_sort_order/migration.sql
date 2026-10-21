ALTER TABLE "OrderItem" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY "orderId" ORDER BY "createdAt" ASC) - 1)::int AS rn
  FROM "OrderItem"
)
UPDATE "OrderItem" AS i
SET "sortOrder" = ranked.rn
FROM ranked
WHERE i.id = ranked.id;

CREATE INDEX "OrderItem_orderId_sortOrder_idx" ON "OrderItem"("orderId", "sortOrder");
