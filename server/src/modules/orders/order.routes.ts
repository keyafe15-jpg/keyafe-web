import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { optionalAuth, requireAuth, type AuthenticatedRequest } from "../../middleware/auth.js";
import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";
import {
  createOrder,
  createOrderSchema,
  getOrderById,
  getOrderByNumber,
} from "./order.service.js";
import {
  cancelOrderAsCustomer,
  withCustomerCancel,
} from "./order.cancel.js";

export const orderRouter = Router();

orderRouter.post("/", optionalAuth, async (req, res) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid order", parsed.error.flatten());
  }

  const payload = {
    ...parsed.data,
    userId: parsed.data.userId ?? (req as any).user?.id,
  };

  const order = await createOrder(payload);
  res.status(StatusCodes.CREATED).json(order);
});

orderRouter.get("/me", requireAuth, async (req, res) => {
  const userId = (req as AuthenticatedRequest).user!.id;

  const orders = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { items: { orderBy: { deliveryDate: "asc" } } },
  });

  res.json(orders.map(withCustomerCancel));
});

orderRouter.post("/:idOrNumber/cancel", async (req, res) => {
  const order = await cancelOrderAsCustomer(req.params.idOrNumber);
  res.json(order);
});

// Accepts either a cuid (order id) or KEY-YYMMDD-XXXXXX (order number)
// so the confirmation link can use either.
orderRouter.get("/:idOrNumber", async (req, res) => {
  const key = req.params.idOrNumber;
  const order = key.startsWith("KEY-")
    ? await getOrderByNumber(key)
    : await getOrderById(key);
  res.json(withCustomerCancel(order));
});
