-- AlterTable
ALTER TABLE "BusinessSettings" ADD COLUMN     "isSameDayStoreClosed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sameDayClosedMessage" TEXT NOT NULL DEFAULT 'Sorry — we''re closed right now. Please check back later.';

-- CreateTable
CREATE TABLE "SameDayScheduleWeekly" (
    "dayOfWeek" INTEGER NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "openTime" TEXT,
    "closeTime" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SameDayScheduleWeekly_pkey" PRIMARY KEY ("dayOfWeek")
);

-- CreateTable
CREATE TABLE "SameDayScheduleException" (
    "date" DATE NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "openTime" TEXT,
    "closeTime" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SameDayScheduleException_pkey" PRIMARY KEY ("date")
);
