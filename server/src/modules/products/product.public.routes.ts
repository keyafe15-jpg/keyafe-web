import { Router } from "express";
import { HttpError } from "../../utils/httpError.js";
import {
  getPublicProductBySlug,
  listPublicProductsByCategorySlug,
  listPanIndiaProducts,
  listSameDayProducts,
  listHealthyTreatProducts,
} from "./product.service.js";

export const publicProductRouter = Router();

// Fixed paths — must be declared BEFORE the /:slug route so Express doesn't
// treat them as a slug.
publicProductRouter.get("/same-day", async (_req, res) => {
  const products = await listSameDayProducts();
  res.setHeader("Cache-Control", "public, max-age=30");
  res.json(products);
});

publicProductRouter.get("/pan-india", async (_req, res) => {
  const products = await listPanIndiaProducts();
  res.setHeader("Cache-Control", "public, max-age=30");
  res.json(products);
});

publicProductRouter.get("/healthy", async (_req, res) => {
  const products = await listHealthyTreatProducts();
  res.setHeader("Cache-Control", "public, max-age=30");
  res.json(products);
});

publicProductRouter.get("/", async (req, res) => {
  const { category, page, pageSize } = req.query;
  if (typeof category !== "string" || !category) {
    throw HttpError.badRequest("Query param 'category' is required");
  }

  const products = await listPublicProductsByCategorySlug(
    category,
    Number(page ?? 1),
    Number(pageSize ?? 12),
  );
  res.setHeader("Cache-Control", "public, max-age=30");
  res.json(products);
});

publicProductRouter.get("/:slug", async (req, res) => {
  const product = await getPublicProductBySlug(req.params.slug);
  res.setHeader("Cache-Control", "public, max-age=30");
  res.json(product);
});
