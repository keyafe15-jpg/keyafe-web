import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { HttpError } from "../../utils/httpError.js";
import {
  createOrderLink,
  createOrderLinkSchema,
  getOrderLinkById,
  getOrderLinkByToken,
  listOrderLinks,
  placeOfflineOrder,
  placeOfflineOrderSchema,
  placeOrderFromLink,
  placeOrderLinkSchema,
  updateOrderLink,
  updateOrderLinkSchema,
} from "./order-link.service.js";

// TODO: gate behind requireAuth + requirePermission("order-links.*") once auth lands.
export const adminOrderLinkRouter = Router();

adminOrderLinkRouter.get("/", async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : null;
  const rows = await listOrderLinks(status);
  res.json(rows);
});

adminOrderLinkRouter.get("/:id", async (req, res) => {
  const link = await getOrderLinkById(req.params.id);
  res.json(link);
});

adminOrderLinkRouter.post("/", async (req, res) => {
  const parsed = createOrderLinkSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid order link", parsed.error.flatten());
  }
  const link = await createOrderLink(parsed.data);
  res.status(StatusCodes.CREATED).json(link);
});

adminOrderLinkRouter.patch("/:id", async (req, res) => {
  const parsed = updateOrderLinkSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid update", parsed.error.flatten());
  }
  const updated = await updateOrderLink(req.params.id, parsed.data);
  res.json(updated);
});

// Public (customer-facing).
export const publicOrderLinkRouter = Router();

publicOrderLinkRouter.get("/:token", async (req, res) => {
  const link = await getOrderLinkByToken(req.params.token);
  res.setHeader("Cache-Control", "no-store");
  res.json(link);
});

publicOrderLinkRouter.post("/:token/place", async (req, res) => {
  const parsed = placeOrderLinkSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid order", parsed.error.flatten());
  }
  const order = await placeOrderFromLink(req.params.token, parsed.data);
  res.status(StatusCodes.CREATED).json(order);
});

// Admin: direct offline-order placement (skips the token flow).
// TODO: gate behind requireAuth + requirePermission("orders.create") once auth lands.
export const adminOfflineOrderRouter = Router();

adminOfflineOrderRouter.post("/place", async (req, res) => {
  const parsed = placeOfflineOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid order", parsed.error.flatten());
  }
  const order = await placeOfflineOrder(parsed.data);
  res.status(StatusCodes.CREATED).json(order);
});
