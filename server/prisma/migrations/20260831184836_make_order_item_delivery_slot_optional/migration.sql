-- AlterTable
ALTER TABLE "OrderItem" ALTER COLUMN "deliveryDate" DROP NOT NULL,
ALTER COLUMN "deliverySlotKey" DROP NOT NULL,
ALTER COLUMN "deliverySlotLabel" DROP NOT NULL;
