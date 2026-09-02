-- AlterTable
ALTER TABLE "Coupon" ADD COLUMN     "waivesDelivery" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Coupon" ADD COLUMN     "restrictedToPhone" TEXT;
ALTER TABLE "Coupon" ADD COLUMN     "note" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "couponCode" TEXT;

-- AlterTable
ALTER TABLE "BusinessSettings" ADD COLUMN     "freeDeliveryFrom" TIMESTAMP(3);
ALTER TABLE "BusinessSettings" ADD COLUMN     "freeDeliveryUntil" TIMESTAMP(3);
ALTER TABLE "BusinessSettings" ADD COLUMN     "freeDeliveryMinCart" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "CouponRedemption" (
    "id" TEXT NOT NULL,
    "couponCode" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CouponRedemption_orderId_key" ON "CouponRedemption"("orderId");

-- CreateIndex
CREATE INDEX "CouponRedemption_couponCode_customerPhone_idx" ON "CouponRedemption"("couponCode", "customerPhone");

-- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_couponCode_fkey" FOREIGN KEY ("couponCode") REFERENCES "Coupon"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
