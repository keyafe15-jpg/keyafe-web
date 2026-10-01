-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deliveryPaidToRider" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "OrderLink" ADD COLUMN     "deliveryPaidToRider" BOOLEAN NOT NULL DEFAULT false;
