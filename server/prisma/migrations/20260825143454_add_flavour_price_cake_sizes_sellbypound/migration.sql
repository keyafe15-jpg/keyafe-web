-- AlterTable
ALTER TABLE "Flavor" ADD COLUMN     "additionalAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "sellByPound" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "CakeSize" (
    "id" TEXT NOT NULL,
    "pounds" DECIMAL(4,2) NOT NULL,
    "label" TEXT NOT NULL,
    "servesText" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CakeSize_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CakeSize_pounds_key" ON "CakeSize"("pounds");
