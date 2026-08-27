import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";
import type { OrderStatus, PaymentStatus } from "@prisma/client";
import { getOrderById, getOrderByNumber } from "./order.service.js";

// TODO: gate behind requireAuth + requirePermission("orders.read/update") once auth is wired.
export const adminOrderRouter = Router();

const ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "IN_KITCHEN",
  "READY",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
] as const satisfies readonly OrderStatus[];

adminOrderRouter.get("/", async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : null;
  const deliveryFrom =
    typeof req.query.deliveryFrom === "string" ? req.query.deliveryFrom : null;
  const deliveryTo =
    typeof req.query.deliveryTo === "string" ? req.query.deliveryTo : null;

  const where: Record<string, unknown> = {};
  if (status && (ORDER_STATUSES as readonly string[]).includes(status)) {
    where.status = status as OrderStatus;
  }

  const dateFilter: { gte?: Date; lt?: Date } = {};
  if (deliveryFrom && /^\d{4}-\d{2}-\d{2}$/.test(deliveryFrom)) {
    const [y, m, d] = deliveryFrom.split("-").map(Number);
    dateFilter.gte = new Date(y!, m! - 1, d!, 0, 0, 0);
  }
  if (deliveryTo && /^\d{4}-\d{2}-\d{2}$/.test(deliveryTo)) {
    const [y, m, d] = deliveryTo.split("-").map(Number);
    // `lt` next-day-midnight so the whole `to` day is included.
    dateFilter.lt = new Date(y!, m! - 1, d! + 1, 0, 0, 0);
  }
  if (dateFilter.gte || dateFilter.lt) {
    where.items = { some: { deliveryDate: dateFilter } };
  }

  const rows = await prisma.order.findMany({
    where: Object.keys(where).length ? where : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      customerPhone: true,
      customerEmail: true,
      fulfillment: true,
      subtotal: true,
      deliveryFee: true,
      total: true,
      status: true,
      paymentStatus: true,
      paymentMethod: true,
      createdAt: true,
      _count: { select: { items: true } },
      items: {
        select: {
          id: true,
          productName: true,
          sizeLabel: true,
          flavourName: true,
          qty: true,
          messageOnCake: true,
          deliveryDate: true,
          deliverySlotKey: true,
          deliverySlotLabel: true,
        },
        orderBy: { deliveryDate: "asc" },
      },
    },
  });
  res.json(
    rows.map((r) => ({
      id: r.id,
      orderNumber: r.orderNumber,
      customerName: r.customerName,
      customerPhone: r.customerPhone,
      customerEmail: r.customerEmail,
      fulfillment: r.fulfillment,
      subtotal: r.subtotal,
      deliveryFee: r.deliveryFee,
      total: r.total,
      status: r.status,
      paymentStatus: r.paymentStatus,
      paymentMethod: r.paymentMethod,
      createdAt: r.createdAt,
      itemCount: r._count.items,
      earliestDelivery: r.items[0]?.deliveryDate ?? null,
      earliestSlotLabel: r.items[0]?.deliverySlotLabel ?? null,
      items: r.items,
    })),
  );
});

adminOrderRouter.get("/counts", async (_req, res) => {
  const grouped = await prisma.order.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const counts: Record<string, number> = {};
  for (const s of ORDER_STATUSES) counts[s] = 0;
  for (const g of grouped) counts[g.status] = g._count._all;
  counts.ALL = Object.values(counts).reduce((a, b) => a + b, 0);
  res.json(counts);
});

adminOrderRouter.get("/:idOrNumber", async (req, res) => {
  const key = req.params.idOrNumber;
  const order = key.startsWith("KEY-")
    ? await getOrderByNumber(key)
    : await getOrderById(key);
  res.json(order);
});

const updateSchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  paymentStatus: z
    .enum(["PENDING", "PAID", "FAILED", "REFUNDED"])
    .optional() satisfies z.ZodType<PaymentStatus | undefined>,
  adminNotes: z.string().trim().max(2000).nullable().optional(),
});

adminOrderRouter.patch("/:id", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid update", parsed.error.flatten());
  }
  const updated = await prisma.order.update({
    where: { id: req.params.id },
    data: parsed.data,
    include: { items: true },
  });
  res.json(updated);
});
