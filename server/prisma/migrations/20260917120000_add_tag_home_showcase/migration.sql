-- AlterTable
ALTER TABLE "Tag" ADD COLUMN     "showOnHome" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Tag_showOnHome_sortOrder_idx" ON "Tag"("showOnHome", "sortOrder");
