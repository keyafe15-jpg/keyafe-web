-- Split offline collections into per-method lines (UPI + cash, etc.).
CREATE TABLE "OrderPayment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "screenshotUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderPayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrderPayment_orderId_idx" ON "OrderPayment"("orderId");

ALTER TABLE "OrderPayment" ADD CONSTRAINT "OrderPayment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- One line per existing offline collection. Cashfree stays on PaymentAttempt.
INSERT INTO "OrderPayment" ("id", "orderId", "method", "amount", "screenshotUrl", "createdAt")
SELECT
    'pay_' || o.id,
    o.id,
    CASE
        WHEN o."paymentMethod" IN ('upi', 'netbanking') THEN o."paymentMethod"
        ELSE 'cash'
    END,
    o."advanceAmount",
    NULLIF(o."paymentScreenshotUrls"[1], ''),
    o."createdAt"
FROM "Order" o
WHERE o."paymentMethod" <> 'cashfree'
  AND (
    o."advanceAmount" > 0
    OR COALESCE(array_length(o."paymentScreenshotUrls", 1), 0) > 0
  );
