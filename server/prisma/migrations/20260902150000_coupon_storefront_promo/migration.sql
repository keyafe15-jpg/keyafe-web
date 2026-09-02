-- AlterTable
ALTER TABLE "Coupon" ADD COLUMN     "showOnStorefront" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Coupon" ADD COLUMN     "headline" TEXT;
ALTER TABLE "Coupon" ADD COLUMN     "storefrontCopy" TEXT;
