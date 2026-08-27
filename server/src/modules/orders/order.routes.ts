import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { HttpError } from "../../utils/httpError.js";
import {
  createOrder,
  createOrderSchema,
  getOrderById,
  getOrderByNumber,
} from "./order.service.js";

export const orderRouter = Router();

orderRouter.post("/", async (req, res) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid order", parsed.error.flatten());
  }
  const order = await createOrder(parsed.data);
  res.status(StatusCodes.CREATED).json(order);
});

// Accepts either a cuid (order id) or KEY-YYMMDD-XXXXXX (order number)
// so the confirmation link can use either.
orderRouter.get("/:idOrNumber", async (req, res) => {
  const key = req.params.idOrNumber;
  const order = key.startsWith("KEY-")
    ? await getOrderByNumber(key)
    : await getOrderById(key);
  res.json(order);
});
