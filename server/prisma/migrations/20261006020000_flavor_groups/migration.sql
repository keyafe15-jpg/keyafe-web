-- CreateTable
CREATE TABLE "FlavorGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlavorGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FlavorGroup_name_key" ON "FlavorGroup"("name");

-- AlterTable
ALTER TABLE "Flavor" ADD COLUMN "groupId" TEXT;

-- Carry over text groups typed before groups became records, ordered by their first flavour.
INSERT INTO "FlavorGroup" ("id", "name", "sortOrder")
SELECT
    'fg_' || md5(g."name" || clock_timestamp()::text),
    g."name",
    (ROW_NUMBER() OVER (ORDER BY g."firstSort", g."name")) * 10
FROM (
    SELECT btrim("group") AS "name", MIN("sortOrder") AS "firstSort"
    FROM "Flavor"
    WHERE "group" IS NOT NULL AND btrim("group") <> ''
    GROUP BY btrim("group")
) g;

UPDATE "Flavor" f
SET "groupId" = fg."id"
FROM "FlavorGroup" fg
WHERE f."group" IS NOT NULL AND btrim(f."group") = fg."name";

-- AlterTable
ALTER TABLE "Flavor" DROP COLUMN "group";

-- CreateIndex
CREATE INDEX "Flavor_groupId_idx" ON "Flavor"("groupId");

-- AddForeignKey
ALTER TABLE "Flavor" ADD CONSTRAINT "Flavor_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "FlavorGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
