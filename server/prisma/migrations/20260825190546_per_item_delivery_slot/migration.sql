/*
  Warnings:

  - You are about to drop the column `deliveryDate` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `deliverySlotKey` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `deliverySlotLabel` on the `Order` table. All the data in the column will be lost.
  - Added the required column `deliveryDate` to the `OrderItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `deliverySlotKey` to the `OrderItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `deliverySlotLabel` to the `OrderItem` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Order" DROP COLUMN "deliveryDate",
DROP COLUMN "deliverySlotKey",
DROP COLUMN "deliverySlotLabel";

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "deliveryDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "deliverySlotKey" TEXT NOT NULL,
ADD COLUMN     "deliverySlotLabel" TEXT NOT NULL;
