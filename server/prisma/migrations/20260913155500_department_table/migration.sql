-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Department_slug_key" ON "Department"("slug");

INSERT INTO "Department" ("id", "slug", "name", "sortOrder", "isActive", "createdAt", "updatedAt")
VALUES
  ('dept_dessert', 'dessert', 'Dessert', 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dept_savory', 'savory', 'Savoury', 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

ALTER TABLE "Category" ADD COLUMN "departmentId" TEXT;

UPDATE "Category" SET "departmentId" = 'dept_dessert' WHERE "department" = 'DESSERT';
UPDATE "Category" SET "departmentId" = 'dept_savory' WHERE "department" = 'SAVORY';

ALTER TABLE "Category" ADD CONSTRAINT "Category_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Category_departmentId_idx" ON "Category"("departmentId");

ALTER TABLE "Category" DROP COLUMN "department";

DROP TYPE "CategoryDepartment";
