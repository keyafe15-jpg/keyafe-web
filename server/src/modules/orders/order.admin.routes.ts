import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";
import type { OrderStatus, PaymentStatus, PaymentMode } from "@prisma/client";
import { getOrderById, getOrderByNumber } from "./order.service.js";
import { cancelOrderAsAdmin } from "./order.cancel.js";
import { assertKitchenOpenOn } from "../store/store.service.js";
import { orderEvents, type NewOrderEvent, type OrderCancelledEvent } from "../../lib/events.js";
import {
  requirePermission,
  staffHasPermission,
  type AuthenticatedRequest,
} from "../../middleware/auth.js";

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

function addressField(addr: unknown, key: "pincode" | "city"): string | null {
  if (!addr || typeof addr !== "object") return null;
  const value = (addr as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function addressPincode(addr: unknown) {
  return addressField(addr, "pincode");
}

function addressCity(addr: unknown) {
  return addressField(addr, "city");
}

function buildAdminOrderListWhere(opts: {
  status?: string | null;
  deliveryFrom?: string | null;
  deliveryTo?: string | null;
  search?: string | null;
  excludeStatuses?: string[];
  panIndia?: boolean;
}): Record<string, unknown> | undefined {
  const and: Record<string, unknown>[] = [];

  if (
    opts.status &&
    (ORDER_STATUSES as readonly string[]).includes(opts.status)
  ) {
    and.push({ status: opts.status });
  }

  if (opts.excludeStatuses && opts.excludeStatuses.length > 0) {
    const valid = opts.excludeStatuses.filter((s) =>
      (ORDER_STATUSES as readonly string[]).includes(s),
    );
    if (valid.length > 0) {
      and.push({ status: { notIn: valid } });
    }
  }

  const dateFilter: { gte?: Date; lt?: Date } = {};
  if (opts.deliveryFrom && /^\d{4}-\d{2}-\d{2}$/.test(opts.deliveryFrom)) {
    const [y, m, d] = opts.deliveryFrom.split("-").map(Number);
    dateFilter.gte = new Date(y!, m! - 1, d!, 0, 0, 0);
  }
  if (opts.deliveryTo && /^\d{4}-\d{2}-\d{2}$/.test(opts.deliveryTo)) {
    const [y, m, d] = opts.deliveryTo.split("-").map(Number);
    dateFilter.lt = new Date(y!, m! - 1, d! + 1, 0, 0, 0);
  }
  if (dateFilter.gte || dateFilter.lt) {
    and.push({ items: { some: { deliveryDate: dateFilter } } });
  }

  if (opts.panIndia) {
    and.push({
      items: {
        some: {},
        every: { deliveryDate: null },
      },
    });
  }

  const q = opts.search?.trim();
  if (q) {
    and.push({
      OR: [
        { orderNumber: { contains: q, mode: "insensitive" } },
        { customerName: { contains: q, mode: "insensitive" } },
        { customerPhone: { contains: q, mode: "insensitive" } },
        { customerEmail: { contains: q, mode: "insensitive" } },
        {
          items: {
            some: { productName: { contains: q, mode: "insensitive" } },
          },
        },
      ],
    });
  }

  if (and.length === 0) return undefined;
  if (and.length === 1) return and[0];
  return { AND: and };
}

adminOrderRouter.get("/", requirePermission("orders.read"), async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : null;
  const deliveryFrom =
    typeof req.query.deliveryFrom === "string" ? req.query.deliveryFrom : null;
  const deliveryTo =
    typeof req.query.deliveryTo === "string" ? req.query.deliveryTo : null;
  const search =
    typeof req.query.search === "string" ? req.query.search : null;
  const excludeStatus =
    typeof req.query.excludeStatus === "string"
      ? req.query.excludeStatus
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
  const panIndia =
    req.query.panIndia === "1" || req.query.panIndia === "true";
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));

  const whereClause = buildAdminOrderListWhere({
    status,
    deliveryFrom,
    deliveryTo,
    search,
    excludeStatuses: excludeStatus,
    panIndia,
  });

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
        deliveryAddress: true,
        _count: { select: { items: true } },
        items: {
          select: {
            id: true,
            productName: true,
            productImage: true,
            sizeLabel: true,
            flavourName: true,
            qty: true,
            messageOnCake: true,
            instructions: true,
            referenceImageUrl: true,
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
      isPanIndia: r.items.length > 0 && r.items.every((i) => !i.deliveryDate),
      pincode: addressPincode(r.deliveryAddress),
      city: addressCity(r.deliveryAddress),
      items: r.items,
    })),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
});

adminOrderRouter.get("/counts", requirePermission("orders.read"), async (_req, res) => {
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

adminOrderRouter.get("/analytics", requirePermission("dashboard.read"), async (req, res) => {
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
adminOrderRouter.get("/stream", requirePermission("orders.read"), (req, res) => {
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
  const onCancelled = (event: OrderCancelledEvent) => {
    res.write(`event: order-cancelled\ndata: ${JSON.stringify(event)}\n\n`);
  };
  orderEvents.on("new-order", onNewOrder);
  orderEvents.on("order-cancelled", onCancelled);

  // Heartbeat every 25s so proxies / load balancers don't cut idle streams.
  const heartbeat = setInterval(() => {
    res.write(`: hb\n\n`);
  }, 25_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    orderEvents.off("new-order", onNewOrder);
    orderEvents.off("order-cancelled", onCancelled);
    res.end();
  });
});

adminOrderRouter.get("/:idOrNumber", requirePermission("orders.read"), async (req, res) => {
  const key = req.params.idOrNumber ?? "";
  if (!key) throw HttpError.badRequest("Missing order id");
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
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        deliveryDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullable(),
        deliverySlotKey: z.string().trim().min(1).nullable(),
        deliverySlotLabel: z.string().trim().min(1).nullable(),
      }),
    )
    .min(1)
    .optional(),
});

adminOrderRouter.patch("/:id", requirePermission("orders.update"), async (req, res) => {
  const id = req.params.id ?? "";
  if (!id) throw HttpError.badRequest("Missing order id");
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid update", parsed.error.flatten());
  }
  const { advanceAmount, paymentStatus, status, items, ...rest } =
    parsed.data;
  const data: Omit<typeof parsed.data, "items"> = { ...rest };

  if (status === "CANCELLED") {
    const staff = (req as AuthenticatedRequest).staff;
    if (!staff || !staffHasPermission(staff, "orders.cancel")) {
      throw HttpError.forbidden("You don't have permission to cancel orders");
    }
    await cancelOrderAsAdmin(id);
  } else if (status !== undefined) {
    data.status = status;
  }

  if (advanceAmount !== undefined) {
    const existing = await prisma.order.findUnique({
      where: { id },
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

  if (items) {
    const existing = await prisma.order.findUnique({
      where: { id },
      select: {
        status: true,
        items: { select: { id: true } },
      },
    });
    if (!existing) throw HttpError.notFound("Order not found");
    if (existing.status === "CANCELLED" || existing.status === "DELIVERED") {
      throw HttpError.badRequest(
        "Can't change delivery date on a delivered or cancelled order.",
      );
    }
    const knownIds = new Set(existing.items.map((i) => i.id));
    for (const item of items) {
      if (!knownIds.has(item.id)) {
        throw HttpError.badRequest("Item does not belong to this order");
      }
      if (item.deliveryDate) {
        if (!item.deliverySlotKey || !item.deliverySlotLabel) {
          throw HttpError.badRequest(
            "Pick a time slot when setting a delivery date.",
          );
        }
        await assertKitchenOpenOn(item.deliveryDate);
      }
    }
    await prisma.$transaction(
      items.map((item) =>
        prisma.orderItem.update({
          where: { id: item.id },
          data: {
            deliveryDate: item.deliveryDate
              ? new Date(`${item.deliveryDate}T00:00:00.000Z`)
              : null,
            deliverySlotKey: item.deliveryDate ? item.deliverySlotKey : null,
            deliverySlotLabel: item.deliveryDate
              ? item.deliverySlotLabel
              : null,
          },
        }),
      ),
    );
  }

  const orderFields = Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined),
  );
  const updated =
    Object.keys(orderFields).length > 0
      ? await prisma.order.update({
          where: { id },
          data: orderFields,
          include: { items: true },
        })
      : await getOrderById(id);
  res.json(updated);
});
