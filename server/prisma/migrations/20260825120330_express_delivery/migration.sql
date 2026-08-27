-- AlterTable
ALTER TABLE "BusinessSettings" ADD COLUMN     "expressEnd" TEXT NOT NULL DEFAULT '23:00',
ADD COLUMN     "expressStart" TEXT NOT NULL DEFAULT '11:00',
ADD COLUMN     "expressSurchargeFee" DECIMAL(10,2) NOT NULL DEFAULT 50;

-- AlterTable
ALTER TABLE "DeliveryPincode" ADD COLUMN     "expressDeliveryFee" DECIMAL(10,2),
ADD COLUMN     "expressEligible" BOOLEAN NOT NULL DEFAULT true;
