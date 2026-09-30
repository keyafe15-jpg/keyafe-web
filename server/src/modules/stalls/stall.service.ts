import { z } from "zod";
import { Prisma, type StallSaleKind } from "@prisma/client";
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

const stallSelect = {
  id: true,
  name: true,
  kind: true,
  location: true,
  startDate: true,
  endDate: true,
  chargeAmount: true,
  chargeBasis: true,
  isActive: true,
  sortOrder: true,
} satisfies Prisma.StallSelect;

type StallRow = Prisma.StallGetPayload<{ select: typeof stallSelect }>;

export type StallStatus = "live" | "upcoming" | "ended";

const dayKey = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

/** Offices are always live; exhibitions only between their dates (IST). */
function stallStatus(s: Pick<StallRow, "kind" | "startDate" | "endDate">, today: string) {
  if (s.kind === "OFFICE") return "live" as const;
  const start = dayKey(s.startDate);
  const end = dayKey(s.endDate);
  if (start && today < start) return "upcoming" as const;
  if (end && today > end) return "ended" as const;
  return "live" as const;
}

/** How far back the counter can enter a missed day; older days go through Stall sales. */
export const COUNTER_BACKDATE_DAYS = 7;

const addDays = (day: string, n: number) => {
  const d = dayToDate(day);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const shortDay = (day: string) =>
  dayToDate(day).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

/** Days the counter may write to: the last week up to today, clipped to an exhibition's run. */
export function counterWindow(
  s: Pick<StallRow, "kind" | "startDate" | "endDate">,
  today = istToday(),
) {
  let from = addDays(today, -COUNTER_BACKDATE_DAYS);
  let to = today;
  if (s.kind === "EXHIBITION") {
    const start = dayKey(s.startDate);
    const end = dayKey(s.endDate);
    if (start && start > from) from = start;
    if (end && end < to) to = end;
  }
  return from <= to ? { from, to } : null;
}

/** Calendar days an exhibition runs, inclusive; null for offices. */
function spanDays(s: Pick<StallRow, "kind" | "startDate" | "endDate">) {
  if (s.kind !== "EXHIBITION" || !s.startDate || !s.endDate) return null;
  return Math.round((s.endDate.getTime() - s.startDate.getTime()) / 86_400_000) + 1;
}

function effectiveChargePaise(s: StallRow) {
  if (s.kind === "OFFICE") return 0;
  const amount = toPaise(s.chargeAmount);
  return s.chargeBasis === "PER_DAY" ? amount * (spanDays(s) ?? 0) : amount;
}

export function stallView(s: StallRow, today = istToday()) {
  return {
    ...s,
    startDate: dayKey(s.startDate),
    endDate: dayKey(s.endDate),
    chargeAmount: Number(s.chargeAmount),
    status: stallStatus(s, today),
    days: spanDays(s),
    effectiveCharge: fromPaise(effectiveChargePaise(s)),
  };
}

/**
 * `counter` lists what staff can sell at today: active offices plus active
 * exhibitions running today. Otherwise every stall, including switched-off
 * ones and their hidden menu items.
 */
export async function listStalls({ counter }: { counter: boolean }) {
  const today = istToday();
  const stalls = await prisma.stall.findMany({
    where: counter ? { isActive: true } : undefined,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      ...stallSelect,
      menuItems: {
        where: counter ? { isActive: true } : undefined,
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: menuItemSelect,
      },
      _count: { select: { days: true } },
    },
  });
  return stalls
    .map(({ menuItems, _count, ...s }) => ({
      ...stallView(s, today),
      counterWindow: counterWindow(s, today),
      dayCount: _count.days,
      menu: menuItems.map(menuItemView),
    }))
    .filter((s) => !counter || s.counterWindow != null);
}

export async function requireStall(stallId: string) {
  const stall = await prisma.stall.findUnique({ where: { id: stallId }, select: stallSelect });
  if (!stall) throw HttpError.notFound("Stall not found");
  return stall;
}

/** For the counter: the stall must be switched on and the day inside its counter window. */
export async function requireCounterDay(stallId: string, day: string) {
  const stall = await requireStall(stallId);
  if (!stall.isActive) throw HttpError.conflict("This stall is switched off.");
  const today = istToday();
  if (day > today) throw HttpError.badRequest("That date is in the future.");
  const window = counterWindow(stall, today);
  if (!window) {
    throw HttpError.conflict(
      stallStatus(stall, today) === "upcoming"
        ? "This exhibition hasn't started yet."
        : "This exhibition ended over a week ago. Add its sales from Stall sales.",
    );
  }
  if (day < window.from || day > window.to) {
    throw HttpError.conflict(
      window.from === window.to
        ? `Sales can only be entered for ${shortDay(window.from)}.`
        : `Pick a date between ${shortDay(window.from)} and ${shortDay(window.to)}.`,
    );
  }
  return stall;
}

export const stallInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  kind: z.enum(["OFFICE", "EXHIBITION"]),
  location: z.string().trim().max(500).nullable(),
  startDate: calendarDay.nullable(),
  endDate: calendarDay.nullable(),
  chargeAmount: z.number().min(0).max(10_000_000),
  chargeBasis: z.enum(["TOTAL", "PER_DAY"]),
  isActive: z.boolean(),
});

type StallInput = z.infer<typeof stallInputSchema>;

/** Exhibitions need a date range; offices carry no dates and no charge. */
function stallData(input: StallInput) {
  if (input.kind === "EXHIBITION") {
    if (!input.startDate || !input.endDate) {
      throw HttpError.badRequest("An exhibition needs a start and end date.");
    }
    if (input.endDate < input.startDate) {
      throw HttpError.badRequest("End date must be on or after the start date.");
    }
  }
  const office = input.kind === "OFFICE";
  return {
    name: input.name,
    kind: input.kind,
    location: input.location || null,
    startDate: office || !input.startDate ? null : dayToDate(input.startDate),
    endDate: office || !input.endDate ? null : dayToDate(input.endDate),
    chargeAmount: office ? 0 : fromPaise(toPaise(input.chargeAmount)),
    chargeBasis: office ? ("TOTAL" as const) : input.chargeBasis,
    isActive: input.isActive,
  };
}

export async function createStall(body: unknown) {
  const parsed = stallInputSchema
    .partial({
      kind: true,
      location: true,
      startDate: true,
      endDate: true,
      chargeAmount: true,
      chargeBasis: true,
      isActive: true,
    })
    .extend({ copyMenuFrom: z.string().min(1).optional() })
    .safeParse(body);
  if (!parsed.success) throw HttpError.badRequest("Invalid stall", parsed.error.flatten());
  const { copyMenuFrom, ...input } = parsed.data;
  const data = stallData({
    kind: "OFFICE",
    location: null,
    startDate: null,
    endDate: null,
    chargeAmount: 0,
    chargeBasis: "TOTAL",
    isActive: true,
    ...input,
  });
  const last = await prisma.stall.aggregate({ _max: { sortOrder: true } });
  const stall = await prisma.stall.create({
    data: { ...data, sortOrder: (last._max.sortOrder ?? 0) + 10 },
    select: { id: true },
  });
  if (copyMenuFrom) await copyMenu(copyMenuFrom, stall.id);
  return stall;
}

export async function updateStall(stallId: string, body: unknown) {
  const parsed = stallInputSchema.partial().safeParse(body);
  if (!parsed.success) throw HttpError.badRequest("Invalid stall", parsed.error.flatten());
  const current = stallView(await requireStall(stallId));
  const data = stallData({
    name: current.name,
    kind: current.kind,
    location: current.location,
    startDate: current.startDate,
    endDate: current.endDate,
    chargeAmount: current.chargeAmount,
    chargeBasis: current.chargeBasis,
    isActive: current.isActive,
    ...parsed.data,
  });
  await prisma.stall.update({ where: { id: stallId }, data });
}

/** Appends the source stall's menu, skipping names the target already has. */
export async function copyMenu(fromStallId: string, toStallId: string) {
  if (fromStallId === toStallId) throw HttpError.badRequest("Pick a different stall to copy from.");
  await requireStall(fromStallId);
  const [source, existing] = await Promise.all([
    prisma.stallMenuItem.findMany({
      where: { stallId: fromStallId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { name: true, price: true, isActive: true },
    }),
    prisma.stallMenuItem.findMany({
      where: { stallId: toStallId },
      select: { name: true, sortOrder: true },
    }),
  ]);
  const taken = new Set(existing.map((m) => m.name.trim().toLowerCase()));
  let sortOrder = Math.max(0, ...existing.map((m) => m.sortOrder));
  const rows = source
    .filter((m) => !taken.has(m.name.trim().toLowerCase()))
    .map((m) => ({ ...m, stallId: toStallId, sortOrder: (sortOrder += 10) }));
  if (rows.length > 0) await prisma.stallMenuItem.createMany({ data: rows });
  return rows.length;
}

// ---------- Money ----------

type KindSums = { kind: StallSaleKind; cash: number; upi: number; count: number };

/**
 * A lump sum is the full count for its day: once a day has any CONSOLIDATED
 * entry, only lump entries count and tapped entries are just a record of what
 * sold. Amounts are in paise.
 */
function dayMoney(rows: KindSums[]) {
  const lumps = rows.filter((r) => r.kind === "CONSOLIDATED");
  const tapped = rows.filter((r) => r.kind === "ITEMIZED");
  const sum = (list: KindSums[], key: "cash" | "upi") => list.reduce((n, r) => n + r[key], 0);
  const counted = lumps.length > 0 ? lumps : tapped;
  return {
    cash: sum(counted, "cash"),
    upi: sum(counted, "upi"),
    count: rows.reduce((n, r) => n + r.count, 0),
    lumpOverride: lumps.length > 0,
    tappedCash: sum(tapped, "cash"),
    tappedUpi: sum(tapped, "upi"),
  };
}

/** Per-day money (lump rule applied) for every day matching `where`. */
async function moneyByDay(where: Prisma.StallSaleWhereInput) {
  const groups = await prisma.stallSale.groupBy({
    by: ["dayId", "kind"],
    where,
    _sum: { cashAmount: true, upiAmount: true },
    _count: { _all: true },
  });
  const byDay = new Map<string, KindSums[]>();
  for (const g of groups) {
    const list = byDay.get(g.dayId) ?? [];
    list.push({
      kind: g.kind,
      cash: toPaise(g._sum.cashAmount ?? 0),
      upi: toPaise(g._sum.upiAmount ?? 0),
      count: g._count._all,
    });
    byDay.set(g.dayId, list);
  }
  return new Map([...byDay].map(([dayId, rows]) => [dayId, dayMoney(rows)]));
}

function totalOf(days: Iterable<{ cash: number; upi: number; count: number }>) {
  let cash = 0;
  let upi = 0;
  let count = 0;
  for (const d of days) {
    cash += d.cash;
    upi += d.upi;
    count += d.count;
  }
  return { cash: fromPaise(cash), upi: fromPaise(upi), total: fromPaise(cash + upi), count };
}

/** All-time sales for one stall against its stall charge. */
export async function getStallSummary(stallId: string) {
  const stall = await requireStall(stallId);
  const days = await moneyByDay({ day: { stallId } });
  const totals = totalOf(days.values());
  const charge = effectiveChargePaise(stall);
  return {
    stall: stallView(stall),
    totals: { ...totals, daysWithSales: days.size },
    charge: fromPaise(charge),
    net: fromPaise(Math.round(totals.total * 100) - charge),
  };
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

export async function closeCounterDay(stallId: string, date: string, staff: StaffUser) {
  await requireStall(stallId);
  const day = await getOrCreateDay(stallId, date);
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
      lumpOverride: false,
      tappedTotals: { cash: 0, upi: 0, total: 0 },
      itemsSold: [],
    };
  }

  const money = dayMoney(
    row.sales.map((s) => ({
      kind: s.kind,
      cash: toPaise(s.cashAmount),
      upi: toPaise(s.upiAmount),
      count: 1,
    })),
  );
  const sold = new Map<string, { name: string; qty: number; amount: number }>();
  const sales = row.sales.map((s) => {
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
      cash: fromPaise(money.cash),
      upi: fromPaise(money.upi),
      total: fromPaise(money.cash + money.upi),
      count: sales.length,
    },
    lumpOverride: money.lumpOverride,
    tappedTotals: {
      cash: fromPaise(money.tappedCash),
      upi: fromPaise(money.tappedUpi),
      total: fromPaise(money.tappedCash + money.tappedUpi),
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
  const money = await moneyByDay({ dayId: { in: days.map((d) => d.id) } });
  const none = { cash: 0, upi: 0, count: 0, lumpOverride: false };

  const kept = days
    .map((d) => ({ d, m: money.get(d.id) ?? none }))
    // An open day whose entries were all undone is just noise.
    .filter(({ d, m }) => m.count > 0 || d.status === "CLOSED");

  return {
    days: kept.map(({ d, m }) => ({
      id: d.id,
      date: d.date.toISOString().slice(0, 10),
      status: d.status,
      stall: d.stall,
      cash: fromPaise(m.cash),
      upi: fromPaise(m.upi),
      total: fromPaise(m.cash + m.upi),
      count: m.count,
      lumpOverride: m.lumpOverride,
    })),
    totals: totalOf(kept.map(({ m }) => m)),
  };
}

/** Stall money for the dashboard. Always fully collected, so sales = received. */
export async function getStallTotals({ from, to }: CalendarRange) {
  const money = await moneyByDay({
    day: { date: { gte: dayToDate(from), lte: dayToDate(to) } },
  });
  const { cash, upi, total } = totalOf(money.values());
  return { sales: total, cash, upi };
}
