import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { HttpError } from "../../utils/httpError.js";
import {
  createProduct,
  createProductSchema,
  getAdminProductById,
  listProducts,
  updateProduct,
  updateProductSchema,
} from "./product.service.js";

// TODO: gate behind requireAuth + requirePermission("products.*") once auth is wired.
export const adminProductRouter = Router();

adminProductRouter.get("/", async (req, res) => {
  const search =
    typeof req.query.search === "string" ? req.query.search : undefined;
  const products = await listProducts(
    Number(req.query.page ?? 1),
    Number(req.query.pageSize ?? 20),
    search,
  );
  res.json(products);
});

adminProductRouter.get("/:id", async (req, res) => {
  const product = await getAdminProductById(req.params.id);
  res.json(product);
});

adminProductRouter.post("/", async (req, res) => {
  const parsed = createProductSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid product data", parsed.error.flatten());
  }
  const product = await createProduct(parsed.data);
  res.status(StatusCodes.CREATED).json(product);
});

adminProductRouter.patch("/:id", async (req, res) => {
  const parsed = updateProductSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest(
      "Invalid product update",
      parsed.error.flatten(),
    );
  }
  const product = await updateProduct(req.params.id, parsed.data);
  res.json(product);
});
