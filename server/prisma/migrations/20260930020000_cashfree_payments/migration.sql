-- CreateEnum
CREATE TYPE "PaymentAttemptStatus" AS ENUM ('CREATED', 'SUCCESS', 'FAILED', 'USER_DROPPED', 'EXPIRED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paidAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PaymentAttempt" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'cashfree',
    "gatewayOrderId" TEXT NOT NULL,
    "paymentSessionId" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'CREATED',
    "gatewayPaymentId" TEXT,
    "paymentGroup" TEXT,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_gatewayOrderId_key" ON "PaymentAttempt"("gatewayOrderId");

-- CreateIndex
CREATE INDEX "PaymentAttempt_orderId_idx" ON "PaymentAttempt"("orderId");

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
