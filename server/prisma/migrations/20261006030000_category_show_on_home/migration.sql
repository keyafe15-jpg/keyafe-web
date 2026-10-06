-- AlterTable
ALTER TABLE "Category" ADD COLUMN "showOnHome" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Category_showOnHome_sortOrder_idx" ON "Category"("showOnHome", "sortOrder");
