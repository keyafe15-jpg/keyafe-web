import { z } from "zod";
import { Prisma, type StallSaleKind } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";
import { getWallTimeInZone } from "../../lib/time.js";
import { calendarDay, dayToDate, type CalendarRange } from "../../lib/calendarDay.js";
import type { StaffUser } from "../../middleware/auth.js";
import { gstinIssue, normalizeGstin } from "../../lib/gstin.js";

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
  billToName: true,
  billToPhone: true,
  billToEmail: true,
  billToGstin: true,
  billToAddress: true,
} satisfies Prisma.StallSelect;

type StallRow = Prisma.StallGetPayload<{ select: typeof stallSelect }>;

export type BillToAddress = z.infer<typeof billToAddressSchema>;

const billToAddressSchema = z.object({
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).nullable().optional(),
  city: z.string().trim().max(80).nullable().optional(),
  pincode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "PIN code must be 6 digits")
    .nullable()
    .optional(),
});

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => v || null);

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
  billToName: optionalText(160),
  billToPhone: optionalText(15).refine((v) => v === null || /^[0-9+\-\s]{7,15}$/.test(v), {
    message: "Enter a valid phone number",
  }),
  billToEmail: optionalText(160).refine(
    (v) => v === null || z.string().email().safeParse(v).success,
    {
      message: "Enter a valid email",
    },
  ),
  billToGstin: optionalText(20)
    .transform((v) => (v ? normalizeGstin(v) : null))
    .refine((v) => v === null || gstinIssue(v) === null, {
      message: "Enter a valid 15-character GSTIN",
    }),
  billToAddress: billToAddressSchema.nullable().optional(),
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
    billToName: input.billToName ?? null,
    billToPhone: input.billToPhone ?? null,
    billToEmail: input.billToEmail ?? null,
    billToGstin: input.billToGstin ?? null,
    billToAddress: input.billToAddress ?? Prisma.DbNull,
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
    billToName: current.billToName,
    billToPhone: current.billToPhone,
    billToEmail: current.billToEmail,
    billToGstin: current.billToGstin,
    billToAddress: current.billToAddress as BillToAddress | null,
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

type Money = { cash: number; upi: number; due: number };
type KindSums = Money & { kind: StallSaleKind; count: number };

/** Paise → rupees for a cash/UPI/due split. Total is sales; received excludes dues. */
function moneyView({ cash, upi, due }: Money) {
  return {
    cash: fromPaise(cash),
    upi: fromPaise(upi),
    due: fromPaise(due),
    received: fromPaise(cash + upi),
    total: fromPaise(cash + upi + due),
  };
}

/**
 * A lump sum is the full count for its day: once a day has any CONSOLIDATED
 * entry, only lump entries count and tapped entries are just a record of what
 * sold. Amounts are in paise.
 */
function dayMoney(rows: KindSums[]) {
  const lumps = rows.filter((r) => r.kind === "CONSOLIDATED");
  const tapped = rows.filter((r) => r.kind === "ITEMIZED");
  const sum = (list: KindSums[]): Money => ({
    cash: list.reduce((n, r) => n + r.cash, 0),
    upi: list.reduce((n, r) => n + r.upi, 0),
    due: list.reduce((n, r) => n + r.due, 0),
  });
  return {
    ...sum(lumps.length > 0 ? lumps : tapped),
    count: rows.reduce((n, r) => n + r.count, 0),
    lumpOverride: lumps.length > 0,
    tapped: sum(tapped),
  };
}

/** Per-day money (lump rule applied) for every day matching `where`. */
async function moneyByDay(where: Prisma.StallSaleWhereInput) {
  const groups = await prisma.stallSale.groupBy({
    by: ["dayId", "kind"],
    where,
    _sum: { cashAmount: true, upiAmount: true, dueAmount: true },
    _count: { _all: true },
  });
  const byDay = new Map<string, KindSums[]>();
  for (const g of groups) {
    const list = byDay.get(g.dayId) ?? [];
    list.push({
      kind: g.kind,
      cash: toPaise(g._sum.cashAmount ?? 0),
      upi: toPaise(g._sum.upiAmount ?? 0),
      due: toPaise(g._sum.dueAmount ?? 0),
      count: g._count._all,
    });
    byDay.set(g.dayId, list);
  }
  return new Map([...byDay].map(([dayId, rows]) => [dayId, dayMoney(rows)]));
}

function totalOf(days: Iterable<Money & { count: number }>) {
  const sum: Money = { cash: 0, upi: 0, due: 0 };
  let count = 0;
  for (const d of days) {
    sum.cash += d.cash;
    sum.upi += d.upi;
    sum.due += d.due;
    count += d.count;
  }
  return { ...moneyView(sum), count };
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
const dueFromSchema = z.string().trim().max(80).optional();
const amountSchema = z.number().min(0).max(10_000_000);

export const saleInputSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("ITEMIZED"),
    paymentMethod: z.enum(["CASH", "UPI", "DUE"]),
    items: z
      .array(z.object({ menuItemId: z.string().min(1), qty: z.number().int().min(1).max(999) }))
      .min(1)
      .max(50),
    dueFrom: dueFromSchema,
    note: noteSchema,
  }),
  z.object({
    kind: z.literal("CONSOLIDATED"),
    cashAmount: amountSchema,
    upiAmount: amountSchema,
    dueAmount: amountSchema.default(0),
    dueFrom: dueFromSchema,
    note: noteSchema,
  }),
]);

export type SaleInput = z.infer<typeof saleInputSchema>;

export function parseSaleInput(body: unknown): SaleInput {
  const parsed = saleInputSchema.safeParse(body);
  if (!parsed.success) throw HttpError.badRequest("Invalid sale", parsed.error.flatten());
  const input = parsed.data;
  const hasDue =
    input.kind === "ITEMIZED" ? input.paymentMethod === "DUE" : toPaise(input.dueAmount) > 0;
  if (
    input.kind === "CONSOLIDATED" &&
    toPaise(input.cashAmount) + toPaise(input.upiAmount) + toPaise(input.dueAmount) <= 0
  ) {
    throw HttpError.badRequest("Enter a cash, UPI or due amount");
  }
  if (hasDue && !input.dueFrom) {
    throw HttpError.badRequest("Enter who owes the due amount");
  }
  return input;
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
    const dueAmount = fromPaise(toPaise(input.dueAmount));
    await prisma.stallSale.create({
      data: {
        ...base,
        cashAmount: fromPaise(toPaise(input.cashAmount)),
        upiAmount: fromPaise(toPaise(input.upiAmount)),
        dueAmount,
        dueFrom: dueAmount > 0 ? input.dueFrom || null : null,
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
      dueAmount: input.paymentMethod === "DUE" ? amount : 0,
      dueFrom: input.paymentMethod === "DUE" ? input.dueFrom || null : null,
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

// ---------- Dues ----------

export const settleDueSchema = z.object({ paidVia: z.enum(["CASH", "UPI"]) });

/**
 * Collects a due: its amount moves into the entry's cash or UPI, so the sale
 * stays on its original day. Allowed on closed days — it's money coming in,
 * not a correction.
 */
export async function settleDue(saleId: string, paidVia: "CASH" | "UPI", staff: StaffUser) {
  const sale = await prisma.stallSale.findUnique({
    where: { id: saleId },
    select: { id: true, dayId: true, dueAmount: true },
  });
  if (!sale) throw HttpError.notFound("Entry not found");
  if (toPaise(sale.dueAmount) <= 0) throw HttpError.conflict("This entry has nothing due.");
  const { count } = await prisma.stallSale.updateMany({
    where: { id: sale.id, dueAmount: sale.dueAmount },
    data: {
      ...(paidVia === "CASH"
        ? { cashAmount: { increment: sale.dueAmount } }
        : { upiAmount: { increment: sale.dueAmount } }),
      dueAmount: 0,
      duePaidAt: new Date(),
      duePaidByName: staff.name,
    },
  });
  if (count === 0) throw HttpError.conflict("This due was just updated. Refresh and try again.");
  return sale.dayId;
}

/** Unpaid dues that count toward sales (tapped dues on a lump-sum day don't). */
export async function listOpenDues(stallId?: string) {
  const rows = await prisma.stallSale.findMany({
    where: {
      dueAmount: { gt: 0 },
      OR: [{ kind: "CONSOLIDATED" }, { day: { sales: { none: { kind: "CONSOLIDATED" } } } }],
      ...(stallId ? { day: { stallId } } : {}),
    },
    orderBy: [{ day: { date: "asc" } }, { createdAt: "asc" }],
    select: {
      id: true,
      kind: true,
      dueAmount: true,
      dueFrom: true,
      note: true,
      createdByName: true,
      createdAt: true,
      items: { select: { name: true, qty: true } },
      day: { select: { date: true, stall: { select: { id: true, name: true } } } },
    },
  });
  const dues = rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    amount: Number(r.dueAmount),
    dueFrom: r.dueFrom,
    note: r.note,
    createdByName: r.createdByName,
    createdAt: r.createdAt,
    items: r.items,
    date: r.day.date.toISOString().slice(0, 10),
    stall: r.day.stall,
  }));
  return {
    total: fromPaise(dues.reduce((n, d) => n + toPaise(d.amount), 0)),
    dues,
  };
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
      dueAmount: true,
      dueFrom: true,
      duePaidAt: true,
      duePaidByName: true,
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
      totals: { ...moneyView({ cash: 0, upi: 0, due: 0 }), count: 0 },
      lumpOverride: false,
      tappedTotals: moneyView({ cash: 0, upi: 0, due: 0 }),
      itemsSold: [],
    };
  }

  const money = dayMoney(
    row.sales.map((s) => ({
      kind: s.kind,
      cash: toPaise(s.cashAmount),
      upi: toPaise(s.upiAmount),
      due: toPaise(s.dueAmount),
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
      dueAmount: Number(s.dueAmount),
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
    totals: { ...moneyView(money), count: sales.length },
    lumpOverride: money.lumpOverride,
    tappedTotals: moneyView(money.tapped),
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
  const none = { cash: 0, upi: 0, due: 0, count: 0, lumpOverride: false };

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
      ...moneyView(m),
      count: m.count,
      lumpOverride: m.lumpOverride,
    })),
    totals: totalOf(kept.map(({ m }) => m)),
  };
}

/** Stall money for the dashboard. Dues are sales not yet received. */
export async function getStallTotals({ from, to }: CalendarRange) {
  const money = await moneyByDay({
    day: { date: { gte: dayToDate(from), lte: dayToDate(to) } },
  });
  const { cash, upi, due, received, total } = totalOf(money.values());
  return { sales: total, received, cash, upi, due };
}
