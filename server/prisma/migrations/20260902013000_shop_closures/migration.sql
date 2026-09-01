-- CreateTable
CREATE TABLE "ShopClosure" (
    "id" TEXT NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopClosure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShopClosure_startsOn_endsOn_idx" ON "ShopClosure"("startsOn", "endsOn");
