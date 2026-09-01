import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";
import type { OrderStatus, PaymentStatus, PaymentMode } from "@prisma/client";
import { getOrderById, getOrderByNumber } from "./order.service.js";
import { orderEvents, type NewOrderEvent } from "../../lib/events.js";

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
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));

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

  const whereClause = Object.keys(where).length ? where : undefined;

  const [total, rows] = await Promise.all([
    prisma.order.count({ where: whereClause }),
    prisma.order.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
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
        paymentMode: true,
        advanceAmount: true,
        paymentScreenshotUrl: true,
        source: true,
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
    }),
  ]);

  res.json({
    items: rows.map((r) => ({
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
      paymentMode: r.paymentMode,
      advanceAmount: r.advanceAmount,
      paymentScreenshotUrl: r.paymentScreenshotUrl,
      source: r.source,
      createdAt: r.createdAt,
      itemCount: r._count.items,
      earliestDelivery: r.items[0]?.deliveryDate ?? null,
      earliestSlotLabel: r.items[0]?.deliverySlotLabel ?? null,
      items: r.items,
    })),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
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

adminOrderRouter.get("/analytics", async (req, res) => {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const parseDate = (value: unknown, fallback: Date) => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return fallback;
    }

    const [year, month, day] = value.split("-").map(Number);
    const parsed = new Date(year!, month! - 1, day!);
    return Number.isNaN(parsed.getTime()) ? fallback : parsed;
  };

  const rangeFrom = parseDate(req.query.from, monthStart);
  const rangeTo = parseDate(req.query.to, today);

  if (rangeFrom > rangeTo) {
    throw HttpError.badRequest("From date must be before or equal to To date.");
  }

  const chartStart = new Date(rangeFrom);
  chartStart.setHours(0, 0, 0, 0);

  const chartEnd = new Date(rangeTo);
  chartEnd.setHours(23, 59, 59, 999);

  const [allTime, thisMonth, selectedRange, chartRows] = await Promise.all([
    prisma.order.aggregate({
      _count: { id: true },
      _sum: {
        total: true,
        cgstAmount: true,
        sgstAmount: true,
        igstAmount: true,
      },
    }),
    prisma.order.aggregate({
      where: {
        createdAt: {
          gte: monthStart,
          lte: today,
        },
      },
      _count: { id: true },
      _sum: {
        total: true,
        cgstAmount: true,
        sgstAmount: true,
        igstAmount: true,
      },
    }),
    prisma.order.aggregate({
      where: {
        createdAt: {
          gte: chartStart,
          lte: chartEnd,
        },
      },
      _count: { id: true },
      _sum: {
        total: true,
        cgstAmount: true,
        sgstAmount: true,
        igstAmount: true,
      },
    }),
    prisma.order.findMany({
      where: {
        createdAt: {
          gte: chartStart,
          lte: chartEnd,
        },
      },
      select: { createdAt: true, total: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const toSafeNumber = (value: unknown): number => {
    if (value == null) return 0;

    if (typeof value === "number" && Number.isFinite(value)) return value;

    if (typeof value === "string") {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    if (typeof value === "object") {
      const candidate = value as {
        toNumber?: () => number;
        toString?: () => string;
      };
      if (typeof candidate.toNumber === "function") {
        const parsed = candidate.toNumber();
        return Number.isFinite(parsed) ? parsed : 0;
      }

      if (typeof candidate.toString === "function") {
        const parsed = Number(candidate.toString());
        return Number.isFinite(parsed) ? parsed : 0;
      }
    }

    return 0;
  };

  const sumGst = (
    value: {
      cgstAmount: unknown;
      sgstAmount: unknown;
      igstAmount: unknown;
    } | null,
  ) =>
    toSafeNumber(value?.cgstAmount) +
    toSafeNumber(value?.sgstAmount) +
    toSafeNumber(value?.igstAmount);

  const salesByDate = new Map<string, { sales: number; orders: number }>();
  for (const row of chartRows) {
    const key = new Date(row.createdAt).toISOString().slice(0, 10);
    const current = salesByDate.get(key) ?? { sales: 0, orders: 0 };
    current.sales += Number(row.total ?? 0);
    current.orders += 1;
    salesByDate.set(key, current);
  }

  const chart: Array<{
    date: string;
    label: string;
    sales: number;
    orders: number;
  }> = [];
  const cursor = new Date(chartStart);
  while (cursor <= chartEnd) {
    const key = new Date(cursor).toISOString().slice(0, 10);
    const bucket = salesByDate.get(key) ?? { sales: 0, orders: 0 };
    chart.push({
      date: key,
      label: cursor.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
      }),
      sales: Number(bucket.sales ?? 0),
      orders: bucket.orders ?? 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  res.json({
    summary: {
      totalOrdersReceived: allTime._count.id ?? 0,
      totalSales: Number(allTime._sum.total ?? 0),
      totalGstReceived: sumGst(allTime._sum),
      ordersThisMonth: thisMonth._count.id ?? 0,
      monthlySales: Number(thisMonth._sum.total ?? 0),
      monthlyGstReceived: sumGst(thisMonth._sum),
      rangeOrders: selectedRange._count.id ?? 0,
      rangeSales: Number(selectedRange._sum.total ?? 0),
      rangeGstReceived: sumGst(selectedRange._sum),
    },
    chart,
  });
});

// Server-Sent Events channel — admin subscribes here and gets a `new-order`
// message every time an order is placed (any source).
adminOrderRouter.get("/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  // Initial hello so the client's onopen fires immediately.
  res.write(`event: ready\ndata: {}\n\n`);

  const onNewOrder = (event: NewOrderEvent) => {
    res.write(`event: new-order\ndata: ${JSON.stringify(event)}\n\n`);
  };
  orderEvents.on("new-order", onNewOrder);

  // Heartbeat every 25s so proxies / load balancers don't cut idle streams.
  const heartbeat = setInterval(() => {
    res.write(`: hb\n\n`);
  }, 25_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    orderEvents.off("new-order", onNewOrder);
    res.end();
  });
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
    .enum(["PENDING", "PARTIAL", "PAID", "FAILED", "REFUNDED"])
    .optional() satisfies z.ZodType<PaymentStatus | undefined>,
  paymentMode: z.enum(["FULL", "ADVANCE"]).optional() satisfies z.ZodType<
    PaymentMode | undefined
  >,
  advanceAmount: z.coerce.number().nonnegative().optional(),
  paymentScreenshotUrl: z.string().url().nullable().optional(),
  adminNotes: z.string().trim().max(2000).nullable().optional(),
});

adminOrderRouter.patch("/:id", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid update", parsed.error.flatten());
  }
  const { advanceAmount, paymentStatus, ...rest } = parsed.data;
  const data: typeof parsed.data = { ...rest };

  if (advanceAmount !== undefined) {
    const existing = await prisma.order.findUnique({
      where: { id: req.params.id },
      select: { total: true },
    });
    if (!existing) throw HttpError.notFound("Order not found");
    const total = Number(existing.total);
    const clamped = Math.min(Math.max(advanceAmount, 0), total);
    data.advanceAmount = clamped;
    // Only auto-derive the status when the caller didn't explicitly set one.
    data.paymentStatus =
      paymentStatus ??
      (clamped <= 0 ? "PENDING" : clamped >= total ? "PAID" : "PARTIAL");
  } else if (paymentStatus !== undefined) {
    data.paymentStatus = paymentStatus;
  }

  const updated = await prisma.order.update({
    where: { id: req.params.id },
    data,
    include: { items: true },
  });
  res.json(updated);
});
