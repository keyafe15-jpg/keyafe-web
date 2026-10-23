-- CreateTable
CREATE TABLE "BooksPayer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameNormalized" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BooksPayer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BooksPayer_nameNormalized_key" ON "BooksPayer"("nameNormalized");

-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN "paidById" TEXT;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN "paidById" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "deliveryPaidById" TEXT;

-- AlterTable
ALTER TABLE "OrderPayment" ADD COLUMN "receivedById" TEXT;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "BooksPayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "BooksPayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_deliveryPaidById_fkey" FOREIGN KEY ("deliveryPaidById") REFERENCES "BooksPayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderPayment" ADD CONSTRAINT "OrderPayment_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "BooksPayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Existing staff become the first payers (same 2–3 people who already log in).
INSERT INTO "BooksPayer" ("id", "name", "nameNormalized", "sortOrder", "isActive", "createdAt", "updatedAt")
SELECT
    'payer_' || u."id",
    u."name",
    lower(regexp_replace(trim(u."name"), '\s+', ' ', 'g')),
    row_number() OVER (ORDER BY u."createdAt") - 1,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "User" u
JOIN "Role" r ON r.id = u."roleId"
WHERE r.slug <> 'customer'
  AND u."isActive" = true
ON CONFLICT ("nameNormalized") DO NOTHING;
