import { Router } from "express";
import { HttpError } from "../../utils/httpError.js";
import {
  getPublicProductBySlug,
  listPublicProductsByCategorySlug,
  listPublicProductsByDepartmentSlug,
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
  const { category, department, page, pageSize } = req.query;
  const pageNum = Number(page ?? 1);
  const sizeNum = Number(pageSize ?? 12);

  if (typeof category === "string" && category) {
    const products = await listPublicProductsByCategorySlug(
      category,
      pageNum,
      sizeNum,
    );
    res.setHeader("Cache-Control", "public, max-age=30");
    res.json(products);
    return;
  }

  if (typeof department === "string" && department) {
    const products = await listPublicProductsByDepartmentSlug(
      department,
      pageNum,
      sizeNum,
    );
    res.setHeader("Cache-Control", "public, max-age=30");
    res.json(products);
    return;
  }

  throw HttpError.badRequest(
    "Query param 'category' or 'department' is required",
  );
});

publicProductRouter.get("/:slug", async (req, res) => {
  const product = await getPublicProductBySlug(req.params.slug);
  res.setHeader("Cache-Control", "public, max-age=30");
  res.json(product);
});
