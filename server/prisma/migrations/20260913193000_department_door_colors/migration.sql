ALTER TABLE "Department" ADD COLUMN "accentHex" TEXT NOT NULL DEFAULT '#E31C79';
ALTER TABLE "Department" ADD COLUMN "softHex" TEXT NOT NULL DEFAULT '#F8D7E6';
ALTER TABLE "Department" ADD COLUMN "deepHex" TEXT NOT NULL DEFAULT '#B0155F';

UPDATE "Department"
SET
  "accentHex" = '#D97706',
  "softHex" = '#F3E0C4',
  "deepHex" = '#7A4A1E'
WHERE "slug" = 'savory';
