-- CreateEnum
CREATE TYPE "RecipeUnit" AS ENUM ('G', 'KG', 'ML', 'L', 'PCS', 'TSP', 'TBSP', 'CUP');

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "currentVersionId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeVersion" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "yieldQty" DECIMAL(10,3),
    "yieldUnit" "RecipeUnit",
    "yieldNote" TEXT,
    "printedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipeVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeIngredient" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "qty" DECIMAL(10,3) NOT NULL,
    "unit" "RecipeUnit" NOT NULL,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "buyItemId" TEXT,
    "componentRecipeId" TEXT,

    CONSTRAINT "RecipeIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeStep" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "text" TEXT NOT NULL,

    CONSTRAINT "RecipeStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeUsageRow" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "axis1" TEXT NOT NULL,
    "axis2" TEXT,
    "qty" DECIMAL(10,3) NOT NULL,
    "unit" "RecipeUnit" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RecipeUsageRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_currentVersionId_key" ON "Recipe"("currentVersionId");

-- CreateIndex
CREATE INDEX "Recipe_categoryId_name_idx" ON "Recipe"("categoryId", "name");

-- CreateIndex
CREATE INDEX "Recipe_archivedAt_idx" ON "Recipe"("archivedAt");

-- CreateIndex
CREATE INDEX "RecipeVersion_recipeId_createdAt_idx" ON "RecipeVersion"("recipeId", "createdAt");

-- CreateIndex
CREATE INDEX "RecipeIngredient_versionId_sortOrder_idx" ON "RecipeIngredient"("versionId", "sortOrder");

-- CreateIndex
CREATE INDEX "RecipeIngredient_componentRecipeId_idx" ON "RecipeIngredient"("componentRecipeId");

-- CreateIndex
CREATE INDEX "RecipeStep_versionId_sortOrder_idx" ON "RecipeStep"("versionId", "sortOrder");

-- CreateIndex
CREATE INDEX "RecipeUsageRow_versionId_sortOrder_idx" ON "RecipeUsageRow"("versionId", "sortOrder");

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "RecipeVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeVersion" ADD CONSTRAINT "RecipeVersion_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "RecipeVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_buyItemId_fkey" FOREIGN KEY ("buyItemId") REFERENCES "BuyItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_componentRecipeId_fkey" FOREIGN KEY ("componentRecipeId") REFERENCES "Recipe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeStep" ADD CONSTRAINT "RecipeStep_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "RecipeVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeUsageRow" ADD CONSTRAINT "RecipeUsageRow_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "RecipeVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
