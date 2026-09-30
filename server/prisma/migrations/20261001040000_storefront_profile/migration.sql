-- AlterTable
ALTER TABLE "BusinessSettings" ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "platformRatings" JSONB,
ADD COLUMN     "publicLocation" JSONB,
ADD COLUMN     "socialLinks" JSONB,
ADD COLUMN     "tagline" TEXT;

-- Start from what the storefront already shows (client/src/content/brand.ts).
UPDATE "BusinessSettings" SET
  "tagline" = 'Handcrafted cakes, cookies & bakes — baked fresh, delivered warm.',
  "socialLinks" = '{"instagram":"https://instagram.com/keyafe","facebook":"https://facebook.com/keyafe","zomato":"https://www.zomato.com/","swiggy":"https://www.swiggy.com/"}',
  "platformRatings" = '{"zomato":{"rating":4.2,"count":1198},"swiggy":{"rating":4.4,"count":224}}',
  "publicLocation" = '{"street":"","locality":"Belur","city":"Howrah","region":"West Bengal","postalCode":"711202","areaServed":["Kolkata","Howrah","Hooghly"],"openingHours":""}'
WHERE "tagline" IS NULL;
