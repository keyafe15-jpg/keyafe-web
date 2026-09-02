import "express-async-errors";
import path from "node:path";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { pinoHttp } from "pino-http";

import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { uploadRouter } from "./modules/uploads/upload.routes.js";
import {
  storeRouter,
  adminBusinessRouter,
  adminStoreRouter,
} from "./modules/store/store.routes.js";
import {
  adminDeliveryRouter,
  deliveryRouter,
} from "./modules/delivery/delivery.routes.js";
import { categoryRouter } from "./modules/categories/category.routes.js";
import { adminCategoryRouter } from "./modules/categories/category.admin.routes.js";
import {
  flavorRouter,
  adminFlavorRouter,
} from "./modules/flavors/flavor.routes.js";
import { tagRouter } from "./modules/tags/tag.routes.js";
import { adminProductRouter } from "./modules/products/product.routes.js";
import { publicProductRouter } from "./modules/products/product.public.routes.js";
import {
  cakeSizeRouter,
  adminCakeSizeRouter,
} from "./modules/cake-sizes/cake-size.routes.js";
import {
  adminToppingRouter,
  toppingRouter,
} from "./modules/toppings/topping.routes.js";
import { orderRouter } from "./modules/orders/order.routes.js";
import { adminOrderRouter } from "./modules/orders/order.admin.routes.js";
import {
  adminOfflineOrderRouter,
  adminOrderLinkRouter,
  publicOrderLinkRouter,
} from "./modules/order-links/order-link.routes.js";
import { adminPushRouter } from "./modules/push/push.routes.js";
import { publicQuoteRouter } from "./modules/quotes/quote.routes.js";
import { adminQuoteRouter } from "./modules/quotes/quote.admin.routes.js";
import { couponRouter } from "./modules/coupons/coupon.routes.js";
import { adminCouponRouter } from "./modules/coupons/coupon.admin.routes.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { addressRouter } from "./modules/addresses/address.routes.js";
import { attachPushToOrderEvents } from "./lib/push.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(
    helmet({
      // Allow images to be embedded from other origins (needed for local uploads served by us).
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
  app.use(
    cors({
      origin: [env.CLIENT_ORIGIN, env.ADMIN_ORIGIN],
      credentials: true,
    }),
  );
  app.use(
    compression({
      // SSE responses must not be buffered — the client expects each
      // `data:` frame to arrive as soon as we write it.
      filter: (req, res) => {
        if (req.path.endsWith("/orders/stream")) return false;
        return compression.filter(req, res);
      },
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(pinoHttp({ logger }));

  if (env.STORAGE_PROVIDER === "local") {
    // In prod this should be served by nginx directly, bypassing Node.
    app.use(
      "/uploads",
      express.static(path.resolve(env.UPLOAD_DIR), {
        fallthrough: false,
        maxAge: "7d",
      }),
    );
  }

  app.use("/api/health", healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/addresses", addressRouter);
  app.use("/api/uploads", uploadRouter);
  app.use("/api/store", storeRouter);
  app.use("/api/delivery", deliveryRouter);
  app.use("/api/categories", categoryRouter);
  app.use("/api/products", publicProductRouter);
  app.use("/api/flavours", flavorRouter);
  app.use("/api/tags", tagRouter);
  app.use("/api/cake-sizes", cakeSizeRouter);
  app.use("/api/toppings", toppingRouter);
  app.use("/api/orders", orderRouter);
  app.use("/api/order-links", publicOrderLinkRouter);
  app.use("/api/quotes", publicQuoteRouter);
  app.use("/api/coupons", couponRouter);
  app.use("/api/admin/products", adminProductRouter);
  app.use("/api/admin/categories", adminCategoryRouter);
  app.use("/api/admin/flavours", adminFlavorRouter);
  app.use("/api/admin/cake-sizes", adminCakeSizeRouter);
  app.use("/api/admin/toppings", adminToppingRouter);
  app.use("/api/admin/orders", adminOrderRouter);
  app.use("/api/admin/order-links", adminOrderLinkRouter);
  app.use("/api/admin/offline-orders", adminOfflineOrderRouter);
  app.use("/api/admin/delivery", adminDeliveryRouter);
  app.use("/api/admin/push", adminPushRouter);
  app.use("/api/admin/business", adminBusinessRouter);
  app.use("/api/admin/store", adminStoreRouter);
  app.use("/api/admin/quotes", adminQuoteRouter);
  app.use("/api/admin/coupons", adminCouponRouter);

  // Fan out new-order events to Web Push subscribers (in addition to SSE).
  attachPushToOrderEvents();

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
