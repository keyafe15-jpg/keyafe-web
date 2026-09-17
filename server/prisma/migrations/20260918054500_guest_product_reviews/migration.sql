-- AlterTable: allow guest reviews (optional user, display name, title, email)
ALTER TABLE "ProductReview" DROP CONSTRAINT IF EXISTS "ProductReview_userId_fkey";

ALTER TABLE "ProductReview" ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "ProductReview" ADD COLUMN IF NOT EXISTS "title" TEXT;
ALTER TABLE "ProductReview" ADD COLUMN IF NOT EXISTS "displayName" TEXT;
ALTER TABLE "ProductReview" ADD COLUMN IF NOT EXISTS "email" TEXT;

-- Backfill displayName from linked user for any existing rows
UPDATE "ProductReview" AS r
SET "displayName" = u.name
FROM "User" AS u
WHERE r."userId" = u.id AND (r."displayName" IS NULL OR r."displayName" = '');

UPDATE "ProductReview" SET "displayName" = 'Customer' WHERE "displayName" IS NULL OR "displayName" = '';

ALTER TABLE "ProductReview" ALTER COLUMN "displayName" SET NOT NULL;

ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
