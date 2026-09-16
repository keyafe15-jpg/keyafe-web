import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { optionalAuth, requireAuth, type AuthenticatedRequest } from "../../middleware/auth.js";
import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";
import { createOrder, createOrderSchema, getOrderById, getOrderByNumber } from "./order.service.js";
import { cancelOrderAsCustomer, withCustomerCancel } from "./order.cancel.js";
import { buildInvoicePdf } from "./invoice.service.js";

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

/**
 * Customer's own copy of the tax invoice.
 *
 * Authorisation matches GET /orders/:idOrNumber above — knowing the order
 * number is enough, because guests have no account and reach their order from
 * the confirmation link. The invoice contains nothing the order response
 * doesn't already expose.
 *
 * Unlike the admin route, this one only serves invoices for orders that are
 * fully paid. That matches when the supply actually happens, and it stops an
 * enumerated request from burning invoice numbers on orders that may never be
 * completed.
 */
orderRouter.get("/:idOrNumber/invoice", async (req, res) => {
  const key = req.params.idOrNumber ?? "";
  const order = key.startsWith("KEY-") ? await getOrderByNumber(key) : await getOrderById(key);

  if (order.status === "CANCELLED") {
    throw HttpError.badRequest("This order was cancelled, so there's no invoice for it.");
  }
  if (order.paymentStatus !== "PAID") {
    throw HttpError.badRequest(
      "Your invoice will be ready once payment is confirmed. Please check back after that, or ask us for it.",
    );
  }

  const { data, pdf, filename } = await buildInvoicePdf(order.id);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Length", pdf.length);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("X-Invoice-Number", data.invoiceNumber);
  res.end(pdf);
});

// Accepts either a cuid (order id) or KEY-YYMMDD-XXXXXX (order number)
// so the confirmation link can use either.
orderRouter.get("/:idOrNumber", async (req, res) => {
  const key = req.params.idOrNumber;
  const order = key.startsWith("KEY-") ? await getOrderByNumber(key) : await getOrderById(key);
  res.json(withCustomerCancel(order));
});
