import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";
import { calendarRange, type CalendarRange } from "../../lib/calendarDay.js";
import { getStallTotals, listOpenDues } from "../stalls/stall.service.js";

// Money owed vs collected, bucketed by delivery date. An order belongs to the
// day of its earliest delivery; pan-India orders (no delivery dates) fall back
// to the IST day they were placed.

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const rangeSchema = calendarRange;

const pendingQuerySchema = z.union([z.object({ scope: z.literal("all") }), rangeSchema]);

type Range = CalendarRange;

const roundMoney = (n: number) => Math.round(n * 100) / 100;

const nextDay = (day: string) => {
  const d = new Date(`${day}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
};

// Delivery dates are stored as UTC midnight of the calendar day, so the range
// bounds are UTC too; `createdAt` is a real instant, so its bounds are IST.
function rangeWhere({ from, to }: Range): Prisma.OrderWhereInput {
  const fromDay = new Date(`${from}T00:00:00.000Z`);
  const toExclusive = nextDay(to);
  return {
    OR: [
      {
        items: {
          some: { deliveryDate: { gte: fromDay, lt: toExclusive } },
          none: { deliveryDate: { lt: fromDay } },
        },
      },
      {
        items: { every: { deliveryDate: null } },
        createdAt: {
          gte: new Date(fromDay.getTime() - IST_OFFSET_MS),
          lt: new Date(toExclusive.getTime() - IST_OFFSET_MS),
        },
      },
    ],
  };
}

// Cancelled/refunded orders aren't owed, and an online checkout that never
// completed isn't a real sale yet.
const collectibleWhere: Prisma.OrderWhereInput = {
  status: { not: "CANCELLED" },
  paymentStatus: { not: "REFUNDED" },
  NOT: { paymentMethod: "cashfree", paidAt: null },
};

type CollectionOrder = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  deliveryDate: string;
  total: number;
  received: number;
  pending: number;
  status: string;
  paymentStatus: string;
};

async function loadOrders(range: Range | null): Promise<CollectionOrder[]> {
  const rows = await prisma.order.findMany({
    where: range ? { AND: [collectibleWhere, rangeWhere(range)] } : collectibleWhere,
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      customerPhone: true,
      total: true,
      advanceAmount: true,
      status: true,
      paymentStatus: true,
      createdAt: true,
      items: {
        where: { deliveryDate: { not: null } },
        select: { deliveryDate: true },
        orderBy: { deliveryDate: "asc" },
        take: 1,
      },
    },
  });

  return rows.map((r) => {
    const total = Number(r.total);
    const received =
      r.paymentStatus === "PAID" ? total : Math.min(Math.max(Number(r.advanceAmount), 0), total);
    const earliest = r.items[0]?.deliveryDate;
    return {
      id: r.id,
      orderNumber: r.orderNumber,
      customerName: r.customerName,
      customerPhone: r.customerPhone,
      deliveryDate: earliest
        ? earliest.toISOString().slice(0, 10)
        : new Date(r.createdAt.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10),
      total,
      received,
      pending: roundMoney(total - received),
      status: r.status,
      paymentStatus: r.paymentStatus,
    };
  });
}

function summarise(orders: CollectionOrder[]) {
  let sales = 0;
  let received = 0;
  let pendingOrders = 0;
  for (const o of orders) {
    sales += o.total;
    received += o.received;
    if (o.pending > 0) pendingOrders += 1;
  }
  return {
    sales: roundMoney(sales),
    received: roundMoney(received),
    pending: roundMoney(sales - received),
    orders: orders.length,
    pendingOrders,
  };
}

export async function getCollectionsSummary(range: Range) {
  const [inRange, allTime, stall, stallDues] = await Promise.all([
    loadOrders(range),
    loadOrders(null),
    getStallTotals(range),
    listOpenDues(),
  ]);
  const owing = allTime.filter((o) => o.pending > 0);
  const orders = summarise(inRange);
  return {
    range: {
      ...orders,
      sales: roundMoney(orders.sales + stall.sales),
      received: roundMoney(orders.received + stall.received),
      pending: roundMoney(orders.pending + stall.due),
      stall,
    },
    outstandingAllTime: {
      pending: roundMoney(owing.reduce((sum, o) => sum + o.pending, 0)),
      customers: new Set(owing.map((o) => o.customerPhone)).size,
      stallDue: stallDues.total,
      stallDueEntries: stallDues.dues.length,
    },
  };
}

export async function getPendingCollections(range: Range | null) {
  const orders = (await loadOrders(range)).filter((o) => o.pending > 0);

  const byPhone = new Map<
    string,
    { customerName: string; phone: string; pending: number; orders: CollectionOrder[] }
  >();
  for (const o of orders) {
    const entry = byPhone.get(o.customerPhone) ?? {
      customerName: o.customerName,
      phone: o.customerPhone,
      pending: 0,
      orders: [],
    };
    entry.pending = roundMoney(entry.pending + o.pending);
    entry.orders.push(o);
    byPhone.set(o.customerPhone, entry);
  }

  const customers = [...byPhone.values()]
    .map((c) => ({
      ...c,
      orders: c.orders.sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate)),
    }))
    .sort((a, b) => b.pending - a.pending);

  return {
    pending: roundMoney(customers.reduce((sum, c) => sum + c.pending, 0)),
    customers,
  };
}

export function parsePendingQuery(query: unknown): Range | null {
  const parsed = pendingQuerySchema.safeParse(query);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid date range", parsed.error.flatten());
  }
  return "scope" in parsed.data ? null : parsed.data;
}

export function parseCollectionsQuery(query: unknown): Range {
  const parsed = rangeSchema.safeParse(query);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid date range", parsed.error.flatten());
  }
  return parsed.data;
}
