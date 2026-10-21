-- Staff extras on a link item, so the customer can add or remove them.
ALTER TABLE "OrderLinkItem" ADD COLUMN "addonIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
