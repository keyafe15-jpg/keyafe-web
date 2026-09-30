-- CreateEnum
CREATE TYPE "StallKind" AS ENUM ('OFFICE', 'EXHIBITION');

-- CreateEnum
CREATE TYPE "StallChargeBasis" AS ENUM ('TOTAL', 'PER_DAY');

-- AlterTable
ALTER TABLE "Stall" ADD COLUMN     "chargeAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "chargeBasis" "StallChargeBasis" NOT NULL DEFAULT 'TOTAL',
ADD COLUMN     "endDate" DATE,
ADD COLUMN     "kind" "StallKind" NOT NULL DEFAULT 'OFFICE',
ADD COLUMN     "location" TEXT,
ADD COLUMN     "startDate" DATE;

