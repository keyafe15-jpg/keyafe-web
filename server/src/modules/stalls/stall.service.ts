import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";
import { getWallTimeInZone } from "../../lib/time.js";
import { calendarDay, dayToDate, type CalendarRange } from "../../lib/calendarDay.js";
import type { StaffUser } from "../../middleware/auth.js";

const toPaise = (value: Prisma.Decimal | number) => Math.round(Number(value) * 100);
const fromPaise = (paise: number) => paise / 100;

export function istToday(): string {
  return getWallTimeInZone(new Date(), "Asia/Kolkata").dateKey.toISOString().slice(0, 10);
}

// ---------- Stalls & menu ----------

const menuItemSelect = {
  id: true,
  name: true,
  price: true,
  isActive: true,
  sortOrder: true,
} satisfies Prisma.StallMenuItemSelect;

type MenuRow = Prisma.StallMenuItemGetPayload<{ select: typeof menuItemSelect }>;

export const menuItemView = (m: MenuRow) => ({ ...m, price: Number(m.price) });

export async function listStalls({ includeInactive }: { includeInactive: boolean }) {
  const stalls = await prisma.stall.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      isActive: true,
      sortOrder: true,
      menuItems: {
        where: includeInactive ? undefined : { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: menuItemSelect,
      },
      _count: { select: { days: true } },
    },
  });
  return stalls.map(({ menuItems, _count, ...s }) => ({
    ...s,
    dayCount: _count.days,
    menu: menuItems.map(menuItemView),
  }));
}

export async function requireStall(stallId: string) {
  const stall = await prisma.stall.findUnique({
    where: { id: stallId },
    select: { id: true, name: true, isActive: true },
  });
  if (!stall) throw HttpError.notFound("Stall not found");
  return stall;
}

// ---------- Sales ----------

const noteSchema = z.string().trim().max(300).optional();

export const saleInputSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("ITEMIZED"),
    paymentMethod: z.enum(["CASH", "UPI"]),
    items: z
      .array(z.object({ menuItemId: z.string().min(1), qty: z.number().int().min(1).max(999) }))
      .min(1)
      .max(50),
    note: noteSchema,
  }),
  z.object({
    kind: z.literal("CONSOLIDATED"),
    cashAmount: z.number().min(0).max(10_000_000),
    upiAmount: z.number().min(0).max(10_000_000),
    note: noteSchema,
  }),
]);

export type SaleInput = z.infer<typeof saleInputSchema>;

export function parseSaleInput(body: unknown): SaleInput {
  const parsed = saleInputSchema.safeParse(body);
  if (!parsed.success) throw HttpError.badRequest("Invalid sale", parsed.error.flatten());
  if (
    parsed.data.kind === "CONSOLIDATED" &&
    toPaise(parsed.data.cashAmount) + toPaise(parsed.data.upiAmount) <= 0
  ) {
    throw HttpError.badRequest("Enter a cash or UPI amount");
  }
  return parsed.data;
}

async function getOrCreateDay(stallId: string, day: string) {
  return prisma.stallDay.upsert({
    where: { stallId_date: { stallId, date: dayToDate(day) } },
    create: { stallId, date: dayToDate(day) },
    update: {},
    select: { id: true, status: true },
  });
}

/**
 * Records a sale on the given stall/day. Prices come from the menu, never the
 * client. `allowClosed` lets admins correct a day that was already closed.
 */
export async function recordSale(
  stallId: string,
  day: string,
  input: SaleInput,
  staff: StaffUser,
  { allowClosed }: { allowClosed: boolean },
) {
  await requireStall(stallId);
  const dayRow = await getOrCreateDay(stallId, day);
  if (dayRow.status === "CLOSED" && !allowClosed) {
    throw HttpError.conflict("This day is closed. Ask an admin to reopen it.");
  }

  const base = {
    dayId: dayRow.id,
    kind: input.kind,
    note: input.note || null,
    createdById: staff.id,
    createdByName: staff.name,
  };

  if (input.kind === "CONSOLIDATED") {
    await prisma.stallSale.create({
      data: {
        ...base,
        cashAmount: fromPaise(toPaise(input.cashAmount)),
        upiAmount: fromPaise(toPaise(input.upiAmount)),
      },
    });
    return dayRow.id;
  }

  const qtyById = new Map<string, number>();
  for (const line of input.items) {
    qtyById.set(line.menuItemId, (qtyById.get(line.menuItemId) ?? 0) + line.qty);
  }
  const menu = await prisma.stallMenuItem.findMany({
    where: { id: { in: [...qtyById.keys()] }, stallId },
    select: { id: true, name: true, price: true, sortOrder: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  if (menu.length !== qtyById.size) {
    throw HttpError.badRequest("Some items are no longer on this stall's menu. Refresh and retry.");
  }

  const totalPaise = menu.reduce((sum, m) => sum + toPaise(m.price) * qtyById.get(m.id)!, 0);
  const amount = fromPaise(totalPaise);
  await prisma.stallSale.create({
    data: {
      ...base,
      cashAmount: input.paymentMethod === "CASH" ? amount : 0,
      upiAmount: input.paymentMethod === "UPI" ? amount : 0,
      items: {
        create: menu.map((m) => ({
          menuItemId: m.id,
          name: m.name,
          price: m.price,
          qty: qtyById.get(m.id)!,
        })),
      },
    },
  });
  return dayRow.id;
}

/** Counter staff may only undo today's sales on an open day; managers anything. */
export async function deleteSale(saleId: string, { canManage }: { canManage: boolean }) {
  const sale = await prisma.stallSale.findUnique({
    where: { id: saleId },
    select: { id: true, day: { select: { id: true, date: true, status: true } } },
  });
  if (!sale) throw HttpError.notFound("Sale not found");
  if (!canManage) {
    if (sale.day.date.toISOString().slice(0, 10) !== istToday()) {
      throw HttpError.forbidden("Only today's entries can be removed from the counter.");
    }
    if (sale.day.status === "CLOSED") {
      throw HttpError.conflict("This day is closed. Ask an admin to reopen it.");
    }
  }
  await prisma.stallSale.delete({ where: { id: sale.id } });
  return sale.day.id;
}

// ---------- Days ----------

export async function setDayStatus(dayId: string, status: "OPEN" | "CLOSED", staff: StaffUser) {
  const updated = await prisma.stallDay.update({
    where: { id: dayId },
    data:
      status === "CLOSED"
        ? { status, closedAt: new Date(), closedById: staff.id, closedByName: staff.name }
        : { status, closedAt: null, closedById: null, closedByName: null },
    select: { id: true },
  });
  return updated.id;
}

export async function closeToday(stallId: string, staff: StaffUser) {
  await requireStall(stallId);
  const day = await getOrCreateDay(stallId, istToday());
  if (day.status === "CLOSED") return day.id;
  return setDayStatus(day.id, "CLOSED", staff);
}

export async function findDayId(stallId: string, day: string) {
  const row = await prisma.stallDay.findUnique({
    where: { stallId_date: { stallId, date: dayToDate(day) } },
    select: { id: true },
  });
  return row?.id ?? null;
}

const daySelect = {
  id: true,
  date: true,
  status: true,
  closedAt: true,
  closedByName: true,
  stall: { select: { id: true, name: true } },
  sales: {
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      kind: true,
      cashAmount: true,
      upiAmount: true,
      note: true,
      createdByName: true,
      createdAt: true,
      items: {
        select: { id: true, menuItemId: true, name: true, price: true, qty: true },
      },
    },
  },
} satisfies Prisma.StallDaySelect;

/** Full sheet for one day. When no row exists yet, returns an empty open day. */
export async function getDayView(
  dayId: string | null,
  fallback?: { stall: { id: string; name: string }; date: string },
) {
  const row = dayId
    ? await prisma.stallDay.findUnique({ where: { id: dayId }, select: daySelect })
    : null;
  if (!row) {
    if (!fallback) throw HttpError.notFound("Day not found");
    return {
      id: null,
      date: fallback.date,
      status: "OPEN" as const,
      closedAt: null,
      closedByName: null,
      stall: fallback.stall,
      sales: [],
      totals: { cash: 0, upi: 0, total: 0, count: 0 },
      itemsSold: [],
    };
  }

  let cash = 0;
  let upi = 0;
  const sold = new Map<string, { name: string; qty: number; amount: number }>();
  const sales = row.sales.map((s) => {
    cash += toPaise(s.cashAmount);
    upi += toPaise(s.upiAmount);
    for (const item of s.items) {
      const key = item.menuItemId ?? `name:${item.name}`;
      const entry = sold.get(key) ?? { name: item.name, qty: 0, amount: 0 };
      entry.qty += item.qty;
      entry.amount += toPaise(item.price) * item.qty;
      sold.set(key, entry);
    }
    return {
      ...s,
      cashAmount: Number(s.cashAmount),
      upiAmount: Number(s.upiAmount),
      items: s.items.map((i) => ({ ...i, price: Number(i.price) })),
    };
  });

  return {
    id: row.id,
    date: row.date.toISOString().slice(0, 10),
    status: row.status,
    closedAt: row.closedAt,
    closedByName: row.closedByName,
    stall: row.stall,
    sales,
    totals: {
      cash: fromPaise(cash),
      upi: fromPaise(upi),
      total: fromPaise(cash + upi),
      count: sales.length,
    },
    itemsSold: [...sold.values()]
      .map((s) => ({ ...s, amount: fromPaise(s.amount) }))
      .sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name)),
  };
}

export const daysQuerySchema = z.object({
  from: calendarDay,
  to: calendarDay,
  stallId: z.string().min(1).optional(),
});

export async function listDays({ from, to, stallId }: z.infer<typeof daysQuerySchema>) {
  const days = await prisma.stallDay.findMany({
    where: {
      date: { gte: dayToDate(from), lte: dayToDate(to) },
      ...(stallId ? { stallId } : {}),
    },
    orderBy: [{ date: "desc" }],
    select: {
      id: true,
      date: true,
      status: true,
      stall: { select: { id: true, name: true } },
    },
  });
  const sums = await prisma.stallSale.groupBy({
    by: ["dayId"],
    where: { dayId: { in: days.map((d) => d.id) } },
    _sum: { cashAmount: true, upiAmount: true },
    _count: { _all: true },
  });
  const byDay = new Map(sums.map((s) => [s.dayId, s]));

  let cash = 0;
  let upi = 0;
  let count = 0;
  const rows = days
    .map((d) => {
      const s = byDay.get(d.id);
      const dayCash = toPaise(s?._sum.cashAmount ?? 0);
      const dayUpi = toPaise(s?._sum.upiAmount ?? 0);
      const dayCount = s?._count._all ?? 0;
      return { d, dayCash, dayUpi, dayCount };
    })
    // An open day whose entries were all undone is just noise.
    .filter(({ d, dayCount }) => dayCount > 0 || d.status === "CLOSED")
    .map(({ d, dayCash, dayUpi, dayCount }) => {
      cash += dayCash;
      upi += dayUpi;
      count += dayCount;
      return {
        id: d.id,
        date: d.date.toISOString().slice(0, 10),
        status: d.status,
        stall: d.stall,
        cash: fromPaise(dayCash),
        upi: fromPaise(dayUpi),
        total: fromPaise(dayCash + dayUpi),
        count: dayCount,
      };
    });

  return {
    days: rows,
    totals: { cash: fromPaise(cash), upi: fromPaise(upi), total: fromPaise(cash + upi), count },
  };
}

/** Stall money for the dashboard. Always fully collected, so sales = received. */
export async function getStallTotals({ from, to }: CalendarRange) {
  const agg = await prisma.stallSale.aggregate({
    where: { day: { date: { gte: dayToDate(from), lte: dayToDate(to) } } },
    _sum: { cashAmount: true, upiAmount: true },
  });
  const cash = toPaise(agg._sum.cashAmount ?? 0);
  const upi = toPaise(agg._sum.upiAmount ?? 0);
  return { sales: fromPaise(cash + upi), cash: fromPaise(cash), upi: fromPaise(upi) };
}
