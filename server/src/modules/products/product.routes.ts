import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { HttpError } from "../../utils/httpError.js";
import {
  archiveProduct,
  createProduct,
  createProductSchema,
  deleteProduct,
  duplicateProduct,
  getAdminProductById,
  listProducts,
  unarchiveProduct,
  updateProduct,
  updateProductSchema,
  type AdminProductListScope,
} from "./product.service.js";

// TODO: gate behind requireAuth + requirePermission("products.*") once auth is wired.
export const adminProductRouter = Router();

const LIST_SCOPES = new Set<AdminProductListScope>(["catalog", "archived", "all"]);

adminProductRouter.get("/", async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const rawScope = typeof req.query.scope === "string" ? req.query.scope : "catalog";
  const scope = LIST_SCOPES.has(rawScope as AdminProductListScope)
    ? (rawScope as AdminProductListScope)
    : "catalog";
  const products = await listProducts(
    Number(req.query.page ?? 1),
    Number(req.query.pageSize ?? 20),
    search,
    scope,
  );
  res.json(products);
});

adminProductRouter.post("/", async (req, res) => {
  const parsed = createProductSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid product data", parsed.error.flatten());
  }
  const product = await createProduct(parsed.data);
  res.status(StatusCodes.CREATED).json(product);
});

adminProductRouter.post("/:id/duplicate", async (req, res) => {
  const product = await duplicateProduct(req.params.id);
  res.status(StatusCodes.CREATED).json(product);
});

adminProductRouter.post("/:id/archive", async (req, res) => {
  const product = await archiveProduct(req.params.id);
  res.json(product);
});

adminProductRouter.post("/:id/unarchive", async (req, res) => {
  const product = await unarchiveProduct(req.params.id);
  res.json(product);
});

adminProductRouter.delete("/:id", async (req, res) => {
  const result = await deleteProduct(req.params.id);
  res.json(result);
});

adminProductRouter.get("/:id", async (req, res) => {
  const product = await getAdminProductById(req.params.id);
  res.json(product);
});

adminProductRouter.patch("/:id", async (req, res) => {
  const parsed = updateProductSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid product update", parsed.error.flatten());
  }
  const product = await updateProduct(req.params.id, parsed.data);
  res.json(product);
});
