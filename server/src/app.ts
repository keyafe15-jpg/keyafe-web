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
import { sitemapRouter } from "./modules/seo/sitemap.routes.js";
import { uploadRouter } from "./modules/uploads/upload.routes.js";
import {
  storeRouter,
  adminBusinessRouter,
  adminStoreRouter,
} from "./modules/store/store.routes.js";
import { adminDeliveryRouter, deliveryRouter } from "./modules/delivery/delivery.routes.js";
import { categoryRouter } from "./modules/categories/category.routes.js";
import { adminCategoryRouter } from "./modules/categories/category.admin.routes.js";
import {
  adminDepartmentRouter,
  departmentRouter,
} from "./modules/departments/department.routes.js";
import { flavorRouter, adminFlavorRouter } from "./modules/flavors/flavor.routes.js";
import { adminTagRouter, tagRouter } from "./modules/tags/tag.routes.js";
import { adminProductRouter } from "./modules/products/product.routes.js";
import { publicProductRouter } from "./modules/products/product.public.routes.js";
import { adminReviewRouter } from "./modules/reviews/review.routes.js";
import { cakeSizeRouter, adminCakeSizeRouter } from "./modules/cake-sizes/cake-size.routes.js";
import { adminToppingRouter, toppingRouter } from "./modules/toppings/topping.routes.js";
import { addonRouter, adminAddonRouter } from "./modules/addons/addon.routes.js";
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
import { adminCustomerRouter } from "./modules/customers/customer.admin.routes.js";
import { adminStaffRouter } from "./modules/staff/staff.routes.js";
import { requirePermission, requireStaff } from "./middleware/auth.js";
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
      // Without this the browser hides these headers from cross-origin
      // fetches, so the admin couldn't name a downloaded document or show the
      // number that was issued for it.
      exposedHeaders: ["Content-Disposition", "X-Invoice-Number", "X-Challan-Number"],
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

  // Served at the root, not under /api, since a sitemap must live at the site
  // root. In production the storefront's web server should proxy it here.
  app.use(sitemapRouter);

  app.use("/api/health", healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/addresses", addressRouter);
  app.use("/api/uploads", uploadRouter);
  app.use("/api/store", storeRouter);
  app.use("/api/delivery", deliveryRouter);
  app.use("/api/categories", categoryRouter);
  app.use("/api/departments", departmentRouter);
  app.use("/api/products", publicProductRouter);
  app.use("/api/flavours", flavorRouter);
  app.use("/api/tags", tagRouter);
  app.use("/api/cake-sizes", cakeSizeRouter);
  app.use("/api/toppings", toppingRouter);
  app.use("/api/addons", addonRouter);
  app.use("/api/orders", orderRouter);
  app.use("/api/order-links", publicOrderLinkRouter);
  app.use("/api/quotes", publicQuoteRouter);
  app.use("/api/coupons", couponRouter);
  app.use(
    "/api/admin/products",
    requireStaff,
    requirePermission("products.write"),
    adminProductRouter,
  );
  app.use(
    "/api/admin/categories",
    requireStaff,
    requirePermission("categories.write"),
    adminCategoryRouter,
  );
  app.use(
    "/api/admin/departments",
    requireStaff,
    requirePermission("categories.write"),
    adminDepartmentRouter,
  );
  app.use(
    "/api/admin/flavours",
    requireStaff,
    requirePermission("flavours.write"),
    adminFlavorRouter,
  );
  app.use(
    "/api/admin/cake-sizes",
    requireStaff,
    requirePermission("cake-sizes.write"),
    adminCakeSizeRouter,
  );
  app.use(
    "/api/admin/toppings",
    requireStaff,
    requirePermission("toppings.write"),
    adminToppingRouter,
  );
  app.use("/api/admin/addons", requireStaff, requirePermission("addons.write"), adminAddonRouter);
  app.use("/api/admin/tags", requireStaff, requirePermission("tags.write"), adminTagRouter);
  app.use("/api/admin/orders", requireStaff, adminOrderRouter);
  app.use("/api/admin/order-links", requireStaff, adminOrderLinkRouter);
  app.use("/api/admin/offline-orders", requireStaff, adminOfflineOrderRouter);
  app.use(
    "/api/admin/delivery",
    requireStaff,
    requirePermission("delivery.write"),
    adminDeliveryRouter,
  );
  app.use("/api/admin/push", requireStaff, adminPushRouter);
  app.use(
    "/api/admin/business",
    requireStaff,
    requirePermission("settings.update"),
    adminBusinessRouter,
  );
  app.use("/api/admin/store", requireStaff, requirePermission("store.write"), adminStoreRouter);
  app.use("/api/admin/quotes", requireStaff, adminQuoteRouter);
  app.use("/api/admin/reviews", requireStaff, adminReviewRouter);
  app.use(
    "/api/admin/coupons",
    requireStaff,
    requirePermission("coupons.write"),
    adminCouponRouter,
  );
  app.use(
    "/api/admin/customers",
    requireStaff,
    requirePermission("customers.read"),
    adminCustomerRouter,
  );
  app.use("/api/admin/staff", requireStaff, adminStaffRouter);

  // Fan out new-order events to Web Push subscribers (in addition to SSE).
  attachPushToOrderEvents();

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
