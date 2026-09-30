-- AlterTable
ALTER TABLE "BusinessSettings" ADD COLUMN     "altPhone" TEXT;

-- Keep the second number the storefront already shows.
UPDATE "BusinessSettings" SET "altPhone" = '9883186892' WHERE "altPhone" IS NULL;
