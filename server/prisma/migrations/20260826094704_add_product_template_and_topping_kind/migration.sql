-- CreateEnum
CREATE TYPE "ProductTemplate" AS ENUM ('CAKE', 'PIZZA', 'OTHER');

-- CreateEnum
CREATE TYPE "ToppingKind" AS ENUM ('TOPPING', 'CONDIMENT');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "template" "ProductTemplate" NOT NULL DEFAULT 'CAKE';

-- AlterTable
ALTER TABLE "Topping" ADD COLUMN     "kind" "ToppingKind" NOT NULL DEFAULT 'TOPPING';
