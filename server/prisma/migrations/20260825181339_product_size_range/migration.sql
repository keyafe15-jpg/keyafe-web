-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "allowCustomSize" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maxGrams" INTEGER,
ADD COLUMN     "minGrams" INTEGER;
