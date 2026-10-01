-- CreateEnum
CREATE TYPE "CreditNoteKind" AS ENUM ('DISCOUNT', 'REFUND');

-- CreateEnum
CREATE TYPE "CreditNoteReason" AS ENUM ('QUALITY', 'DAMAGED', 'LATE_DELIVERY', 'WRONG_ITEM', 'GOODWILL', 'OTHER');

-- CreateTable
CREATE TABLE "CreditNote" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "creditNoteNumber" TEXT NOT NULL,
    "creditNoteDate" TIMESTAMP(3) NOT NULL,
    "kind" "CreditNoteKind" NOT NULL,
    "reason" "CreditNoteReason" NOT NULL,
    "note" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "taxableAmount" DECIMAL(10,2) NOT NULL,
    "cgstAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "sgstAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "igstAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "lines" JSONB NOT NULL,
    "refundMethod" TEXT,
    "proofUrl" TEXT,
    "createdByName" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreditNote_creditNoteNumber_key" ON "CreditNote"("creditNoteNumber");

-- CreateIndex
CREATE INDEX "CreditNote_orderId_idx" ON "CreditNote"("orderId");

-- CreateIndex
CREATE INDEX "CreditNote_creditNoteDate_idx" ON "CreditNote"("creditNoteDate");

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
