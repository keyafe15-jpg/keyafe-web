-- CreateEnum
CREATE TYPE "VendorChannel" AS ENUM ('OFFLINE', 'ONLINE');

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN "channel" "VendorChannel" NOT NULL DEFAULT 'OFFLINE';

-- CreateIndex
CREATE INDEX "Vendor_channel_isActive_idx" ON "Vendor"("channel", "isActive");

UPDATE "Vendor" SET "channel" = 'ONLINE' WHERE lower(name) = 'arife aesthetics';
