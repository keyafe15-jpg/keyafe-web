-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "supplies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "gstin" TEXT,
    "notes" TEXT,
    "upiId" TEXT,
    "accountHint" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Vendor_isActive_name_idx" ON "Vendor"("isActive", "name");

-- CreateIndex
CREATE INDEX "Vendor_name_idx" ON "Vendor"("name");
