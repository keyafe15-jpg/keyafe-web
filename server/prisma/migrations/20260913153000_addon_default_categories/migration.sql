-- CreateTable
CREATE TABLE "_CategoryDefaultAddons" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_CategoryDefaultAddons_AB_unique" ON "_CategoryDefaultAddons"("A", "B");

-- CreateIndex
CREATE INDEX "_CategoryDefaultAddons_B_index" ON "_CategoryDefaultAddons"("B");

-- AddForeignKey
ALTER TABLE "_CategoryDefaultAddons" ADD CONSTRAINT "_CategoryDefaultAddons_A_fkey" FOREIGN KEY ("A") REFERENCES "Addon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CategoryDefaultAddons" ADD CONSTRAINT "_CategoryDefaultAddons_B_fkey" FOREIGN KEY ("B") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
