-- CreateEnum
CREATE TYPE "StallDayStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "StallSaleKind" AS ENUM ('ITEMIZED', 'CONSOLIDATED');

-- CreateTable
CREATE TABLE "Stall" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Stall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StallMenuItem" (
    "id" TEXT NOT NULL,
    "stallId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StallMenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StallDay" (
    "id" TEXT NOT NULL,
    "stallId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "StallDayStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "closedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StallDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StallSale" (
    "id" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "kind" "StallSaleKind" NOT NULL,
    "cashAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "upiAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StallSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StallSaleItem" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "menuItemId" TEXT,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "qty" INTEGER NOT NULL,

    CONSTRAINT "StallSaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StallMenuItem_stallId_sortOrder_idx" ON "StallMenuItem"("stallId", "sortOrder");

-- CreateIndex
CREATE INDEX "StallDay_date_idx" ON "StallDay"("date");

-- CreateIndex
CREATE UNIQUE INDEX "StallDay_stallId_date_key" ON "StallDay"("stallId", "date");

-- CreateIndex
CREATE INDEX "StallSale_dayId_createdAt_idx" ON "StallSale"("dayId", "createdAt");

-- CreateIndex
CREATE INDEX "StallSaleItem_saleId_idx" ON "StallSaleItem"("saleId");

-- AddForeignKey
ALTER TABLE "StallMenuItem" ADD CONSTRAINT "StallMenuItem_stallId_fkey" FOREIGN KEY ("stallId") REFERENCES "Stall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StallDay" ADD CONSTRAINT "StallDay_stallId_fkey" FOREIGN KEY ("stallId") REFERENCES "Stall"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StallSale" ADD CONSTRAINT "StallSale_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "StallDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StallSaleItem" ADD CONSTRAINT "StallSaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "StallSale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

