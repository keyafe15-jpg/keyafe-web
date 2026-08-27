import { Router } from "express";
import { HttpError } from "../../utils/httpError.js";
import {
  getPublicProductBySlug,
  listPublicProductsByCategorySlug,
} from "./product.service.js";

export const publicProductRouter = Router();

publicProductRouter.get("/", async (req, res) => {
  const { category } = req.query;
  if (typeof category !== "string" || !category) {
    throw HttpError.badRequest("Query param 'category' is required");
  }
  const products = await listPublicProductsByCategorySlug(category);
  res.setHeader("Cache-Control", "public, max-age=30");
  res.json(products);
});

publicProductRouter.get("/:slug", async (req, res) => {
  const product = await getPublicProductBySlug(req.params.slug);
  res.setHeader("Cache-Control", "public, max-age=30");
  res.json(product);
});
