/*
  Warnings:

  - Dropping `pounds` from `CakeSize`; existing seed rows are wiped and repopulated by the seeder.
  - `grams` (Int) is the new unique multiplier column (500g = 1 pound = 1x basePrice).
*/

-- Clear the 8 seed rows so we can add a NOT NULL column without a default.
TRUNCATE TABLE "CakeSize";

-- DropIndex
DROP INDEX "CakeSize_pounds_key";

-- AlterTable
ALTER TABLE "CakeSize" DROP COLUMN "pounds",
ADD COLUMN     "grams" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "CakeSize_grams_key" ON "CakeSize"("grams");

