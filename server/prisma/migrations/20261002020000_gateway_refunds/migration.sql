-- CreateEnum
CREATE TYPE "GatewayRefundStatus" AS ENUM ('PENDING', 'SUCCESS', 'CANCELLED', 'ONHOLD');

-- CreateTable
CREATE TABLE "GatewayRefund" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "paymentAttemptId" TEXT NOT NULL,
    "creditNoteId" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'cashfree',
    "gatewayOrderId" TEXT NOT NULL,
    "refundId" TEXT NOT NULL,
    "gatewayRefundId" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "GatewayRefundStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "createdByName" TEXT,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GatewayRefund_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GatewayRefund_creditNoteId_key" ON "GatewayRefund"("creditNoteId");

-- CreateIndex
CREATE UNIQUE INDEX "GatewayRefund_refundId_key" ON "GatewayRefund"("refundId");

-- CreateIndex
CREATE INDEX "GatewayRefund_orderId_idx" ON "GatewayRefund"("orderId");

-- AddForeignKey
ALTER TABLE "GatewayRefund" ADD CONSTRAINT "GatewayRefund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GatewayRefund" ADD CONSTRAINT "GatewayRefund_paymentAttemptId_fkey" FOREIGN KEY ("paymentAttemptId") REFERENCES "PaymentAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GatewayRefund" ADD CONSTRAINT "GatewayRefund_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "CreditNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

