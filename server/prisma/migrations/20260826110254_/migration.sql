/*
  Warnings:

  - You are about to drop the column `priceDelta` on the `Option` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "PriceMode" AS ENUM ('ABSOLUTE', 'DELTA');

-- AlterTable
ALTER TABLE "Option" DROP COLUMN "priceDelta",
ADD COLUMN     "price" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "OptionGroup" ADD COLUMN     "priceMode" "PriceMode" NOT NULL DEFAULT 'DELTA';
