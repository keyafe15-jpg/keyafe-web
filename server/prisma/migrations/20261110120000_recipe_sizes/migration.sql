-- CreateTable
CREATE TABLE "RecipeSize" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RecipeSize_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeIngredientQty" (
    "id" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "sizeId" TEXT NOT NULL,
    "qty" DECIMAL(10,3),

    CONSTRAINT "RecipeIngredientQty_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecipeSize_versionId_sortOrder_idx" ON "RecipeSize"("versionId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeIngredientQty_ingredientId_sizeId_key" ON "RecipeIngredientQty"("ingredientId", "sizeId");

-- CreateIndex
CREATE INDEX "RecipeIngredientQty_sizeId_idx" ON "RecipeIngredientQty"("sizeId");

-- AddForeignKey
ALTER TABLE "RecipeSize" ADD CONSTRAINT "RecipeSize_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "RecipeVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredientQty" ADD CONSTRAINT "RecipeIngredientQty_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "RecipeIngredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredientQty" ADD CONSTRAINT "RecipeIngredientQty_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "RecipeSize"("id") ON DELETE CASCADE ON UPDATE CASCADE;
