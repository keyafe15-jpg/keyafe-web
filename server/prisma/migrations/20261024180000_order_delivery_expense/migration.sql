-- AlterTable
ALTER TABLE "Expense" ADD COLUMN "orderId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Expense_orderId_key" ON "Expense"("orderId");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
