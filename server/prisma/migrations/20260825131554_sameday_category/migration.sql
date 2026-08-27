-- CreateTable
CREATE TABLE "SameDayCategory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SameDayCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SameDayCategory_slug_key" ON "SameDayCategory"("slug");

-- CreateIndex
CREATE INDEX "SameDayCategory_isActive_sortOrder_idx" ON "SameDayCategory"("isActive", "sortOrder");
