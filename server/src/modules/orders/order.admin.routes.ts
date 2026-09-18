import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";
import { Prisma } from "@prisma/client";
import type { OrderStatus, PaymentStatus, PaymentMode } from "@prisma/client";
import { getOrderById, getOrderByNumber } from "./order.service.js";
import { cancelOrderAsAdmin } from "./order.cancel.js";
import { buildInvoicePdf, sendInvoiceEmail } from "./invoice.service.js";
import { buildChallanPdf } from "./challan.service.js";
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

/**
 * A `YYYY-MM-DD` day as sent by `<input type="date">`, resolved to local
 * midnight. The refine rejects rollovers like 2026-02-31, which the regex
 * alone would let through and Date would silently turn into March 3rd.
 */
const isoDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
  .superRefine((value, ctx) => {
    const [y, m, d] = value.split("-").map(Number);
    const parsed = new Date(y!, m! - 1, d!);
    if (parsed.getFullYear() !== y || parsed.getMonth() !== m! - 1 || parsed.getDate() !== d) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Not a real date" });
    }
  })
  .transform((value) => {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y!, m! - 1, d!, 0, 0, 0, 0);
  });

/** Blank query params mean "unset" rather than "match the empty string". */
const optionalText = z
  .string()
  .optional()
  .transform((value) => value?.trim() || undefined);

/** A comma-separated `?excludeStatus=DELIVERED,CANCELLED` list. */
const statusListParam = z
  .string()
  .transform((value) =>
    value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  )
  .pipe(z.array(z.enum(ORDER_STATUSES)))
  .optional();

export const listQuerySchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  deliveryFrom: isoDay.optional(),
  deliveryTo: isoDay.optional(),
  search: optionalText,
  excludeStatus: statusListParam,
  panIndia: z
    .enum(["0", "1", "true", "false"])
    .transform((value) => value === "1" || value === "true")
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  // Capped so a client can't ask for the whole table in one request. The
  // admin's board and pan-India views already request exactly 100.
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

type OrderListQuery = z.infer<typeof listQuerySchema>;

const analyticsQuerySchema = z.object({
  from: isoDay.optional(),
  to: isoDay.optional(),
});

// The schedule lists delivery events rather than orders, so its unit is a
// (order, delivery date, slot) group and `dir` sorts by that date.
export const scheduleQuerySchema = z.object({
  deliveryFrom: isoDay.optional(),
  deliveryTo: isoDay.optional(),
  status: z.enum(ORDER_STATUSES).optional(),
  excludeStatus: statusListParam,
  search: optionalText,
  dir: z.enum(["asc", "desc"]).default("asc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

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

/**
 * The requested delivery window, or null when no range was given. Shared by
 * the order `where` and the nested item selection so the summary an order
 * carries describes the window that matched it.
 */
function deliveryDateFilter(
  opts: Pick<OrderListQuery, "deliveryFrom" | "deliveryTo">,
): { gte?: Date; lt?: Date } | null {
  const filter: { gte?: Date; lt?: Date } = {};
  if (opts.deliveryFrom) {
    filter.gte = opts.deliveryFrom;
  }
  if (opts.deliveryTo) {
    // `deliveryTo` is inclusive, so the exclusive bound is the next midnight.
    const next = new Date(opts.deliveryTo);
    next.setDate(next.getDate() + 1);
    filter.lt = next;
  }
  return filter.gte || filter.lt ? filter : null;
}

/** Free-text match across the order's own fields and the products on it. */
function orderSearchOr(q: string): Prisma.OrderWhereInput[] {
  return [
    { orderNumber: { contains: q, mode: "insensitive" } },
    { customerName: { contains: q, mode: "insensitive" } },
    { customerCompanyName: { contains: q, mode: "insensitive" } },
    { customerPhone: { contains: q, mode: "insensitive" } },
    { customerEmail: { contains: q, mode: "insensitive" } },
    { items: { some: { productName: { contains: q, mode: "insensitive" } } } },
  ];
}

// Takes the parsed query, so statuses are known-valid enum members and the
// dates are already real Dates; no re-validation needed here.
function buildAdminOrderListWhere(opts: OrderListQuery): Record<string, unknown> | undefined {
  const and: Record<string, unknown>[] = [];

  if (opts.status) {
    and.push({ status: opts.status });
  }

  if (opts.excludeStatus && opts.excludeStatus.length > 0) {
    and.push({ status: { notIn: opts.excludeStatus } });
  }

  const dateFilter = deliveryDateFilter(opts);
  if (dateFilter) {
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

  if (opts.search) {
    and.push({ OR: orderSearchOr(opts.search) });
  }

  if (and.length === 0) return undefined;
  if (and.length === 1) return and[0];
  return { AND: and };
}

adminOrderRouter.get("/", requirePermission("orders.read"), async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid filters", parsed.error.flatten());
  }
  const { page, pageSize } = parsed.data;

  const whereClause = buildAdminOrderListWhere(parsed.data);
  // An order matches on *some* item in the window, so the items it carries
  // are scoped to that same window. Otherwise an order with cakes on the
  // 15th and the 17th, listed for the 17th, would summarise as the 15th.
  const itemWindow = deliveryDateFilter(parsed.data);

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
        customerCompanyName: true,
        customerPhone: true,
        customerEmail: true,
        recipientName: true,
        deliveryPhone: true,
        isSurpriseGift: true,
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
          ...(itemWindow ? { where: { deliveryDate: itemWindow } } : {}),
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
      customerCompanyName: r.customerCompanyName,
      customerPhone: r.customerPhone,
      customerEmail: r.customerEmail,
      recipientName: r.recipientName,
      deliveryPhone: r.deliveryPhone,
      isSurpriseGift: r.isSurpriseGift,
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

// Delivery events, not orders: one entry per (order, delivery date, slot), so
// an order with items on two dates is listed under each of them. Declared
// above the `/:idOrNumber` routes so "schedule" isn't matched as an id.
adminOrderRouter.get("/schedule", requirePermission("orders.read"), async (req, res) => {
  const parsed = scheduleQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid filters", parsed.error.flatten());
  }
  const { deliveryFrom, deliveryTo, status, excludeStatus, search, dir, page, pageSize } =
    parsed.data;

  // Without an explicit lower bound the tab opens as a forward-looking prep
  // queue rather than replaying the whole delivery history.
  const from = deliveryFrom ?? startOfToday();
  const deliveryDate: Prisma.DateTimeNullableFilter = { not: null, gte: from };
  if (deliveryTo) {
    const next = new Date(deliveryTo);
    next.setDate(next.getDate() + 1);
    deliveryDate.lt = next;
  }

  // Kept as an AND list so `status` and `excludeStatus` can both apply.
  const orderAnd: Prisma.OrderWhereInput[] = [];
  if (status) orderAnd.push({ status });
  if (excludeStatus && excludeStatus.length > 0) {
    orderAnd.push({ status: { notIn: excludeStatus } });
  }
  if (search) orderAnd.push({ OR: orderSearchOr(search) });

  const where: Prisma.OrderItemWhereInput = {
    deliveryDate,
    ...(orderAnd.length > 0 ? { order: { AND: orderAnd } } : {}),
  };

  // `by` is inlined in both calls rather than shared: Prisma infers the shape
  // of `_count`/`_sum` from the array literal.
  const [allGroups, groups] = await Promise.all([
    // Counting groups needs the grouping itself; `_count` would count rows.
    // Cheap here because the result is one row per delivery event.
    prisma.orderItem.groupBy({
      by: ["orderId", "deliveryDate", "deliverySlotKey"],
      where,
    }),
    prisma.orderItem.groupBy({
      by: ["orderId", "deliveryDate", "deliverySlotKey"],
      where,
      orderBy: [{ deliveryDate: dir }, { deliverySlotKey: "asc" }, { orderId: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      _count: { _all: true },
      _sum: { qty: true },
    }),
  ]);
  const total = allGroups.length;

  const rows =
    groups.length === 0
      ? []
      : await prisma.orderItem.findMany({
          where: {
            OR: groups.map((g) => ({
              orderId: g.orderId,
              deliveryDate: g.deliveryDate,
              deliverySlotKey: g.deliverySlotKey,
            })),
          },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            orderId: true,
            deliveryDate: true,
            deliverySlotKey: true,
            deliverySlotLabel: true,
            productName: true,
            productImage: true,
            sizeLabel: true,
            flavourName: true,
            qty: true,
            messageOnCake: true,
            instructions: true,
            referenceImageUrl: true,
            order: {
              select: {
                id: true,
                orderNumber: true,
                customerName: true,
                customerCompanyName: true,
                customerPhone: true,
                status: true,
                paymentStatus: true,
                fulfillment: true,
                source: true,
                isSurpriseGift: true,
                total: true,
                deliveryAddress: true,
              },
            },
          },
        });

  const groupKey = (orderId: string, date: Date | null, slotKey: string | null) =>
    `${orderId}|${date ? date.toISOString() : ""}|${slotKey ?? ""}`;

  const byGroup = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = groupKey(row.orderId, row.deliveryDate, row.deliverySlotKey);
    const bucket = byGroup.get(key);
    if (bucket) bucket.push(row);
    else byGroup.set(key, [row]);
  }

  res.json({
    items: groups.map((g) => {
      const key = groupKey(g.orderId, g.deliveryDate, g.deliverySlotKey);
      const lines = byGroup.get(key) ?? [];
      const order = lines[0]?.order ?? null;
      return {
        key,
        deliveryDate: g.deliveryDate,
        deliverySlotKey: g.deliverySlotKey,
        deliverySlotLabel: lines[0]?.deliverySlotLabel ?? null,
        itemCount: g._count._all,
        totalQty: g._sum.qty ?? 0,
        order: order && {
          id: order.id,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          customerCompanyName: order.customerCompanyName,
          customerPhone: order.customerPhone,
          status: order.status,
          paymentStatus: order.paymentStatus,
          fulfillment: order.fulfillment,
          source: order.source,
          isSurpriseGift: order.isSurpriseGift,
          // The whole order's money, not this event's. Never sum it across
          // entries or a two-date order gets counted twice.
          orderTotal: order.total,
          pincode: addressPincode(order.deliveryAddress),
          city: addressCity(order.deliveryAddress),
        },
        items: lines.map((l) => ({
          id: l.id,
          productName: l.productName,
          productImage: l.productImage,
          sizeLabel: l.sizeLabel,
          flavourName: l.flavourName,
          qty: l.qty,
          messageOnCake: l.messageOnCake,
          instructions: l.instructions,
          referenceImageUrl: l.referenceImageUrl,
        })),
      };
    }),
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

  const parsed = analyticsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid date range", parsed.error.flatten());
  }

  // Defaults are month-to-date, so they depend on "now" and can't live in the
  // schema. Both bounds get their time normalised below.
  const rangeFrom = parsed.data.from ?? monthStart;
  const rangeTo = parsed.data.to ?? today;

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
  const order = key.startsWith("KEY-") ? await getOrderByNumber(key) : await getOrderById(key);
  res.json(order);
});

// Both invoice routes assign a permanent number on first use, which is why
// they sit behind invoices.read rather than orders.read.
adminOrderRouter.get("/:id/invoice", requirePermission("invoices.read"), async (req, res) => {
  const id = req.params.id ?? "";
  if (!id) throw HttpError.badRequest("Missing order id");
  const { data, pdf, filename } = await buildInvoicePdf(id);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Length", pdf.length);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  // Lets the admin UI show the issued number without parsing the PDF.
  res.setHeader("X-Invoice-Number", data.invoiceNumber);
  res.end(pdf);
});

adminOrderRouter.post(
  "/:id/invoice/email",
  requirePermission("invoices.read"),
  async (req, res) => {
    const id = req.params.id ?? "";
    if (!id) throw HttpError.badRequest("Missing order id");
    const result = await sendInvoiceEmail(id);
    res.json(result);
  },
);

// Delivery challan. Separate permission from invoices: this is the goods
// handover note, not a tax document, and it draws from its own number series.
// Deliberately not gated on payment — the challan travels with the goods
// whether or not the money has arrived.
adminOrderRouter.get("/:id/challan", requirePermission("challans.read"), async (req, res) => {
  const id = req.params.id ?? "";
  if (!id) throw HttpError.badRequest("Missing order id");
  const { data, pdf, filename } = await buildChallanPdf(id);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Length", pdf.length);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  // Lets the admin UI show the issued number without parsing the PDF.
  res.setHeader("X-Challan-Number", data.challanNumber);
  res.end(pdf);
});

const updateSchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  paymentStatus: z
    .enum(["PENDING", "PARTIAL", "PAID", "FAILED", "REFUNDED"])
    .optional() satisfies z.ZodType<PaymentStatus | undefined>,
  paymentMode: z.enum(["FULL", "ADVANCE"]).optional() satisfies z.ZodType<PaymentMode | undefined>,
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
  const { advanceAmount, paymentStatus, status, items, ...rest } = parsed.data;
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
      paymentStatus ?? (clamped <= 0 ? "PENDING" : clamped >= total ? "PAID" : "PARTIAL");
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
      throw HttpError.badRequest("Can't change delivery date on a delivered or cancelled order.");
    }
    const knownIds = new Set(existing.items.map((i) => i.id));
    for (const item of items) {
      if (!knownIds.has(item.id)) {
        throw HttpError.badRequest("Item does not belong to this order");
      }
      if (item.deliveryDate) {
        if (!item.deliverySlotKey || !item.deliverySlotLabel) {
          throw HttpError.badRequest("Pick a time slot when setting a delivery date.");
        }
        await assertKitchenOpenOn(item.deliveryDate);
      }
    }
    await prisma.$transaction(
      items.map((item) =>
        prisma.orderItem.update({
          where: { id: item.id },
          data: {
            deliveryDate: item.deliveryDate ? new Date(`${item.deliveryDate}T00:00:00.000Z`) : null,
            deliverySlotKey: item.deliveryDate ? item.deliverySlotKey : null,
            deliverySlotLabel: item.deliveryDate ? item.deliverySlotLabel : null,
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
