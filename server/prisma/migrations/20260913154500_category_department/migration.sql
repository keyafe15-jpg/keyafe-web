-- CreateEnum
CREATE TYPE "CategoryDepartment" AS ENUM ('DESSERT', 'SAVORY');

-- AlterTable
ALTER TABLE "Category" ADD COLUMN "department" "CategoryDepartment";

-- Existing top-level catalogue
UPDATE "Category" SET "department" = 'DESSERT'
WHERE "parentId" IS NULL
  AND "slug" IN ('celebration-cakes', 'dry-cakes', 'tubs');

UPDATE "Category" SET "department" = 'SAVORY'
WHERE "parentId" IS NULL
  AND "slug" IN ('pizzas', 'panuozzo', 'focaccia-sandwich', 'house-special-snacks');
