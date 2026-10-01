import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";
import { logger } from "../../utils/logger.js";
import { calendarDay, dayToDate, type CalendarRange } from "../../lib/calendarDay.js";
import type { StaffUser } from "../../middleware/auth.js";
import { nextOrderNumber } from "../orders/order.service.js";
import { computeLineTax, getSellerStateCode, sumLineTax } from "../orders/order.tax.js";
import {
  addressLines,
  asAddress,
  ensureInvoiceNumber,
  getSellerSettings,
} from "../orders/invoice.service.js";
import { istToday, requireCounterDay, requireStall } from "./stall.service.js";
import { renderBreakfastStatementPdf } from "./breakfast-statement.pdf.js";

// Prepared food served on site is a restaurant-style service: SAC 996331 at 5%
// without input tax credit, with the plate price already including the GST.
const BREAKFAST_SAC_CODE = "996331";
const BREAKFAST_GST_RATE = 5;

const toPaise = (value: Prisma.Decimal | number) => Math.round(Number(value) * 100);
const fromPaise = (paise: number) => paise / 100;

export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Expected YYYY-MM");

function monthRange(month: string) {
  const from = dayToDate(`${month}-01`);
  const to = new Date(from);
  to.setUTCMonth(to.getUTCMonth() + 1);
  return { gte: from, lt: to };
}

export const monthLabel = (month: string) =>
  dayToDate(`${month}-01`).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

const dayLabel = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "UTC" });

const entrySelect = {
  id: true,
  date: true,
  plates: true,
  platePrice: true,
  items: true,
  note: true,
  orderId: true,
  createdByName: true,
  createdAt: true,
} satisfies Prisma.StallBreakfastSelect;

type EntryRow = Prisma.StallBreakfastGetPayload<{ select: typeof entrySelect }>;

function entryView(e: EntryRow) {
  return {
    ...e,
    date: e.date.toISOString().slice(0, 10),
    platePrice: Number(e.platePrice),
    amount: fromPaise(toPaise(e.platePrice) * e.plates),
  };
}

export const breakfastInputSchema = z.object({
  date: calendarDay.optional(),
  plates: z.number().int().min(1).max(200),
  platePrice: z.number().min(1).max(10_000),
  items: z.string().trim().min(1, "Say what was on the plate").max(300),
  note: z
    .string()
    .trim()
    .max(300)
    .optional()
    .nullable()
    .transform((v) => v || null),
});

export type BreakfastInput = z.infer<typeof breakfastInputSchema>;

export function parseBreakfastInput(body: unknown) {
  const parsed = breakfastInputSchema.safeParse(body);
  if (!parsed.success)
    throw HttpError.badRequest("Invalid breakfast entry", parsed.error.flatten());
  return parsed.data;
}

async function requireOfficeStall(stallId: string) {
  const stall = await requireStall(stallId);
  if (stall.kind !== "OFFICE") {
    throw HttpError.badRequest("Breakfast billing is only for office stalls.");
  }
  return stall;
}

/**
 * Counter staff log within the counter window; managers may log any past day
 * (e.g. catching up a month before billing).
 */
export async function addBreakfast(
  stallId: string,
  input: BreakfastInput,
  staff: StaffUser,
  { canManage }: { canManage: boolean },
) {
  await requireOfficeStall(stallId);
  const date = input.date ?? istToday();
  if (canManage) {
    if (date > istToday()) throw HttpError.badRequest("That date is in the future.");
  } else {
    await requireCounterDay(stallId, date);
  }
  const row = await prisma.stallBreakfast.create({
    data: {
      stallId,
      date: dayToDate(date),
      plates: input.plates,
      platePrice: fromPaise(toPaise(input.platePrice)),
      items: input.items,
      note: input.note,
      createdByName: staff.name,
    },
    select: entrySelect,
  });
  return entryView(row);
}

async function requireUnbilled(id: string) {
  const row = await prisma.stallBreakfast.findUnique({
    where: { id },
    select: { id: true, stallId: true, date: true, orderId: true },
  });
  if (!row) throw HttpError.notFound("Breakfast entry not found");
  if (row.orderId) {
    throw HttpError.conflict("This breakfast is already on a bill, so it can't be changed.");
  }
  return row;
}

export async function updateBreakfast(id: string, body: unknown) {
  const parsed = breakfastInputSchema.partial().safeParse(body);
  if (!parsed.success)
    throw HttpError.badRequest("Invalid breakfast entry", parsed.error.flatten());
  await requireUnbilled(id);
  const { date, platePrice, ...rest } = parsed.data;
  if (date && date > istToday()) throw HttpError.badRequest("That date is in the future.");
  const { count } = await prisma.stallBreakfast.updateMany({
    where: { id, orderId: null },
    data: {
      ...rest,
      ...(date ? { date: dayToDate(date) } : {}),
      ...(platePrice !== undefined ? { platePrice: fromPaise(toPaise(platePrice)) } : {}),
    },
  });
  if (count === 0)
    throw HttpError.conflict("This breakfast was just billed. Refresh and try again.");
}

/** Counter staff may only remove today's entries; managers any unbilled one. */
export async function deleteBreakfast(id: string, { canManage }: { canManage: boolean }) {
  const row = await requireUnbilled(id);
  if (!canManage && row.date.toISOString().slice(0, 10) !== istToday()) {
    throw HttpError.forbidden("Only today's breakfast can be removed from the counter.");
  }
  const { count } = await prisma.stallBreakfast.deleteMany({ where: { id, orderId: null } });
  if (count === 0)
    throw HttpError.conflict("This breakfast was just billed. Refresh and try again.");
}

/** What the add form prefills from: the last plate, and item names used lately. */
async function recentBreakfast(stallId: string) {
  const recent = await prisma.stallBreakfast.findMany({
    where: { stallId },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { plates: true, platePrice: true, items: true },
  });
  const seen = new Set<string>();
  const itemNames: string[] = [];
  for (const r of recent) {
    for (const name of r.items.split(",")) {
      const clean = name.trim();
      if (!clean || seen.has(clean.toLowerCase())) continue;
      seen.add(clean.toLowerCase());
      itemNames.push(clean);
    }
  }
  const last = recent[0];
  return {
    last: last
      ? { plates: last.plates, platePrice: Number(last.platePrice), items: last.items }
      : null,
    itemNames: itemNames.slice(0, 16),
  };
}

export async function getBreakfastMonth(stallId: string, month: string) {
  const stall = await requireOfficeStall(stallId);
  const [rows, recent] = await Promise.all([
    prisma.stallBreakfast.findMany({
      where: { stallId, date: monthRange(month) },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      select: entrySelect,
    }),
    recentBreakfast(stallId),
  ]);
  const entries = rows.map(entryView);
  const orderIds = [...new Set(rows.map((r) => r.orderId).filter((id): id is string => !!id))];
  const bills = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      orderNumber: true,
      invoiceNumber: true,
      paymentStatus: true,
      total: true,
      createdAt: true,
    },
  });
  const unbilled = entries.filter((e) => !e.orderId);
  const sumPaise = (list: typeof entries) => list.reduce((n, e) => n + toPaise(e.amount), 0);
  return {
    stall: {
      id: stall.id,
      name: stall.name,
      billToName: stall.billToName,
      billToPhone: stall.billToPhone,
      billToEmail: stall.billToEmail,
      billToGstin: stall.billToGstin,
      billToAddress: stall.billToAddress,
    },
    month,
    monthLabel: monthLabel(month),
    entries,
    totals: {
      plates: entries.reduce((n, e) => n + e.plates, 0),
      amount: fromPaise(sumPaise(entries)),
      days: new Set(entries.map((e) => e.date)).size,
      unbilledCount: unbilled.length,
      unbilledAmount: fromPaise(sumPaise(unbilled)),
    },
    bills: bills.map((b) => ({ ...b, total: Number(b.total) })),
    ...recent,
  };
}

/**
 * Raises the month's bill: one already-delivered order for the company with a
 * line per breakfast day, so it gets a GST invoice number straight away and
 * shows as pending until the company pays.
 */
export async function createBreakfastBill(stallId: string, month: string) {
  const stall = await requireOfficeStall(stallId);
  if (!stall.billToName || !stall.billToPhone) {
    throw HttpError.badRequest("Add the company's name and phone under Bill to first.");
  }
  const entries = await prisma.stallBreakfast.findMany({
    where: { stallId, orderId: null, date: monthRange(month) },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    select: entrySelect,
  });
  if (entries.length === 0) {
    throw HttpError.badRequest(`There's no unbilled breakfast in ${monthLabel(month)}.`);
  }

  const sellerStateCode = await getSellerStateCode();
  const lines = entries.map((e) => {
    const lineTotal = fromPaise(toPaise(e.platePrice) * e.plates);
    const tax = computeLineTax({
      lineInclusive: lineTotal,
      gstRate: BREAKFAST_GST_RATE,
      priceIsGstInclusive: true,
      isIntraState: true,
    });
    return {
      productName: `Breakfast plate · ${dayLabel(e.date)}`,
      description: e.items,
      deliveryDate: e.date,
      unitPrice: Number(e.platePrice),
      qty: e.plates,
      lineTotal,
      hsnCode: BREAKFAST_SAC_CODE,
      gstRate: BREAKFAST_GST_RATE,
      ...tax,
    };
  });
  const total = fromPaise(lines.reduce((n, l) => n + toPaise(l.lineTotal), 0));
  const { taxableAmount, cgstAmount, sgstAmount, igstAmount } = sumLineTax(lines);
  const plates = entries.reduce((n, e) => n + e.plates, 0);

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        orderNumber: await nextOrderNumber(tx),
        customerName: stall.billToName!,
        customerPhone: stall.billToPhone!,
        customerEmail: stall.billToEmail,
        customerCompanyName: stall.billToName,
        customerGstin: stall.billToGstin,
        fulfillment: "PICKUP",
        billingAddress: (stall.billToAddress as Prisma.InputJsonValue | null) ?? undefined,
        subtotal: total,
        total,
        taxableAmount,
        cgstAmount,
        sgstAmount,
        igstAmount,
        // Served at the office stall, so the supply happens in our own state.
        placeOfSupply: sellerStateCode,
        paymentMethod: "netbanking",
        paymentStatus: "PENDING",
        paymentMode: "FULL",
        status: "DELIVERED",
        source: "STALL_BILL",
        adminNotes: `Breakfast at ${stall.name}, ${monthLabel(month)}: ${plates} plates.`,
        items: { create: lines },
      },
      select: { id: true, orderNumber: true },
    });
    const { count } = await tx.stallBreakfast.updateMany({
      where: { id: { in: entries.map((e) => e.id) }, orderId: null },
      data: { orderId: created.id },
    });
    if (count !== entries.length) {
      throw HttpError.conflict("Breakfast entries changed while billing. Refresh and try again.");
    }
    return created;
  });

  try {
    await ensureInvoiceNumber(order.id);
  } catch (err) {
    logger.error({ err, orderId: order.id }, "breakfast bill invoice number failed");
  }
  return order;
}

// ---------- Dashboard money ----------

const rangeDates = (range: CalendarRange | null): Prisma.StallBreakfastWhereInput =>
  range ? { date: { gte: dayToDate(range.from), lte: dayToDate(range.to) } } : {};

/**
 * Breakfast money by the day it was served. Unbilled plates are owed by the
 * company; billed ones follow their bill order's payments, shared across the
 * bill's entries so edits or discounts on the order carry through.
 */
export async function getBreakfastTotals(range: CalendarRange) {
  const rows = await prisma.stallBreakfast.findMany({
    where: {
      ...rangeDates(range),
      OR: [
        { orderId: null },
        { order: { status: { not: "CANCELLED" }, paymentStatus: { not: "REFUNDED" } } },
      ],
    },
    select: {
      plates: true,
      platePrice: true,
      order: {
        select: {
          total: true,
          advanceAmount: true,
          paymentStatus: true,
          breakfasts: { select: { plates: true, platePrice: true } },
        },
      },
    },
  });
  let sales = 0;
  let received = 0;
  let unbilled = 0;
  for (const r of rows) {
    const amount = toPaise(r.platePrice) * r.plates;
    if (!r.order) {
      sales += amount;
      unbilled += amount;
      continue;
    }
    const billed = r.order.breakfasts.reduce((n, b) => n + toPaise(b.platePrice) * b.plates, 0);
    const share = billed > 0 ? amount / billed : 0;
    const total = toPaise(r.order.total);
    const paid =
      r.order.paymentStatus === "PAID"
        ? total
        : Math.min(Math.max(toPaise(r.order.advanceAmount), 0), total);
    sales += total * share;
    received += paid * share;
  }
  sales = Math.round(sales);
  received = Math.round(received);
  return {
    sales: fromPaise(sales),
    received: fromPaise(received),
    pending: fromPaise(sales - received),
    unbilled: fromPaise(unbilled),
  };
}

/** Breakfast served but not on a bill yet, per stall. */
export async function listUnbilledBreakfast(range: CalendarRange | null) {
  const rows = await prisma.stallBreakfast.findMany({
    where: { orderId: null, ...rangeDates(range) },
    orderBy: { date: "asc" },
    select: {
      date: true,
      plates: true,
      platePrice: true,
      stall: { select: { id: true, name: true, billToName: true } },
    },
  });
  const byStall = new Map<
    string,
    {
      stallId: string;
      stallName: string;
      billToName: string | null;
      amount: number;
      plates: number;
      entries: number;
      from: string;
      to: string;
    }
  >();
  for (const r of rows) {
    const day = r.date.toISOString().slice(0, 10);
    const entry = byStall.get(r.stall.id) ?? {
      stallId: r.stall.id,
      stallName: r.stall.name,
      billToName: r.stall.billToName,
      amount: 0,
      plates: 0,
      entries: 0,
      from: day,
      to: day,
    };
    entry.amount += toPaise(r.platePrice) * r.plates;
    entry.plates += r.plates;
    entry.entries += 1;
    entry.to = day;
    byStall.set(r.stall.id, entry);
  }
  const stalls = [...byStall.values()].map((s) => ({ ...s, amount: fromPaise(s.amount) }));
  return {
    total: fromPaise(stalls.reduce((n, s) => n + toPaise(s.amount), 0)),
    stalls,
  };
}

export async function buildBreakfastStatement(stallId: string, month: string) {
  const data = await getBreakfastMonth(stallId, month);
  if (data.entries.length === 0) {
    throw HttpError.badRequest(`There's no breakfast in ${data.monthLabel}.`);
  }
  const settings = await getSellerSettings();
  const address = data.stall.billToAddress ? asAddress(data.stall.billToAddress) : null;
  const pdf = await renderBreakfastStatementPdf({
    seller: {
      name: settings.tradeName,
      legalName: settings.legalName,
      addressLines: addressLines(asAddress(settings.registeredAddress)),
      phone: settings.supportPhone,
      email: settings.supportEmail,
      gstin: settings.gstin,
    },
    billTo: {
      name: data.stall.billToName ?? "—",
      addressLines: address ? addressLines(address) : [],
      phone: data.stall.billToPhone,
      email: data.stall.billToEmail,
      gstin: data.stall.billToGstin,
    },
    stallName: data.stall.name,
    monthLabel: data.monthLabel,
    invoiceNumbers: data.bills.map((b) => b.invoiceNumber).filter((n): n is string => !!n),
    rows: data.entries.map((e) => ({
      date: dayLabel(dayToDate(e.date)),
      items: e.items,
      plates: e.plates,
      rate: e.platePrice,
      amount: e.amount,
    })),
    totalPlates: data.totals.plates,
    totalAmount: data.totals.amount,
  });
  const slug = data.stall.name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return { pdf, filename: `breakfast-${slug}-${month}.pdf` };
}
