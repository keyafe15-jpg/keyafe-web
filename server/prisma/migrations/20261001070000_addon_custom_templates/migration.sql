-- AlterTable
ALTER TABLE "Addon" ADD COLUMN "customTemplates" "ProductTemplate"[] DEFAULT ARRAY[]::"ProductTemplate"[];
