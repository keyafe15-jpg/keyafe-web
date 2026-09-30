-- AlterTable
ALTER TABLE "OrderLink" ADD COLUMN "allowOnlinePayment" BOOLEAN NOT NULL DEFAULT false;

-- Links created before this toggle offered online payment; keep them that way.
UPDATE "OrderLink" SET "allowOnlinePayment" = true;
