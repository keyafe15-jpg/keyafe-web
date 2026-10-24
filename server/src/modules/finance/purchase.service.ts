import type { BooksPaymentMethod, ExpensePurpose, Prisma, PurchasePurpose } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { gstinLooksLike, normalizeGstin } from "../../lib/gstin.js";
import { normalizeCustomerPhone, phoneLookupVariants } from "../../lib/phone.js";
import { HttpError } from "../../utils/httpError.js";
import { roundMoney } from "../coupons/coupon.service.js";
import {
  buyItemSelect,
  dateKey,
  expenseInclude,
  gstParts,
  money,
  isMiscChargeName,
  isSalaryCategory,
  isShippingChargeName,
  normalizeItemName,
  purposeFromPurchase,
  purchaseInclude,
  qtyNum,
  payerBrief,
  vendorBrief,
} from "./books.shared.js";

const BUY_ITEM_UNITS = new Set(["KG", "L", "PCS", "PACKET"]);

export function serializeBuyItem(row: {
  id: string;
  name: string;
  nameNormalized: string;
  unit: string;
  packSize: number | null;
  isActive: boolean;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  categoryId?: string | null;
  category?: { id: string; slug: string; name: string } | null;
}) {
  return {
    id: row.id,
    name: row.name,
    nameNormalized: row.nameNormalized,
    unit: row.unit,
    packSize: row.packSize,
    isActive: row.isActive,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    categoryId: row.categoryId ?? row.category?.id ?? null,
    category: row.category
      ? { id: row.category.id, slug: row.category.slug, name: row.category.name }
      : null,
  };
}

export function serializePurchase(row: {
  id: string;
  date: Date;
  vendorId: string;
  purpose: PurchasePurpose;
  paymentMethod: BooksPaymentMethod;
  notes: string | null;
  shipping: { toString(): string } | number;
  miscCharges?: { toString(): string } | number;
  cgst?: { toString(): string } | number;
  sgst?: { toString(): string } | number;
  igst?: { toString(): string } | number;
  total: { toString(): string } | number;
  createdByUserId: string;
  paidById?: string | null;
  voidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  paidBy?: { id: string; name: string } | null;
  vendor: { id: string; name: string; phone: string | null; channel?: string };
  lines: {
    id: string;
    buyItemId: string;
    categoryId?: string;
    qty: { toString(): string } | number;
    unitPrice: { toString(): string } | number;
    amount: { toString(): string } | number;
    purpose: PurchasePurpose | null;
    category?: { id: string; slug: string; name: string } | null;
    buyItem: {
      id: string;
      name: string;
      unit: string;
      packSize: number | null;
      categoryId?: string | null;
      category?: { id: string; slug: string; name: string } | null;
    };
  }[];
  expense: { id: string; categoryId: string } | null;
}) {
  return {
    id: row.id,
    date: dateKey(row.date),
    vendorId: row.vendorId,
    vendor: vendorBrief(row.vendor),
    purpose: row.purpose,
    paymentMethod: row.paymentMethod,
    notes: row.notes,
    shipping: money(row.shipping),
    miscCharges: money(row.miscCharges ?? 0),
    cgst: money(row.cgst ?? 0),
    sgst: money(row.sgst ?? 0),
    igst: money(row.igst ?? 0),
    gst: money(money(row.cgst ?? 0) + money(row.sgst ?? 0) + money(row.igst ?? 0)),
    total: money(row.total),
    createdByUserId: row.createdByUserId,
    paidById: row.paidById ?? row.paidBy?.id ?? null,
    paidBy: payerBrief(row.paidBy),
    voidedAt: row.voidedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    expenseId: row.expense?.id ?? null,
    categoryId: row.expense?.categoryId ?? null,
    lines: row.lines.map((line) => ({
      id: line.id,
      buyItemId: line.buyItemId,
      categoryId: line.categoryId ?? line.category?.id ?? null,
      category: line.category
        ? { id: line.category.id, slug: line.category.slug, name: line.category.name }
        : null,
      buyItem: {
        id: line.buyItem.id,
        name: line.buyItem.name,
        unit: line.buyItem.unit,
        packSize: line.buyItem.packSize,
        categoryId: line.buyItem.categoryId ?? line.buyItem.category?.id ?? null,
        category: line.buyItem.category
          ? {
              id: line.buyItem.category.id,
              slug: line.buyItem.category.slug,
              name: line.buyItem.category.name,
            }
          : null,
      },
      qty: qtyNum(line.qty),
      unitPrice: money(line.unitPrice),
      amount: money(line.amount),
      purpose: line.purpose,
    })),
  };
}

function cleanVendorGstin(raw?: string | null): string | null {
  if (!raw?.trim()) return null;
  const gstin = normalizeGstin(raw);
  return gstinLooksLike(gstin) ? gstin : null;
}

function foldVendorName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(
      /\b(pvt|private|ltd|limited|llp|opc|enterprise|enterprises|trader|traders|trading|and|the|co|company|dist|distributor|distributors)\b/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function vendorNameScore(a: string, b: string): number {
  const fa = foldVendorName(a);
  const fb = foldVendorName(b);
  if (!fa || !fb) return 0;
  if (fa === fb) return 100;
  if (fa.includes(fb) || fb.includes(fa)) {
    const short = Math.min(fa.length, fb.length);
    const long = Math.max(fa.length, fb.length);
    if (short < 4) return 0;
    return 60 + (40 * short) / long;
  }
  return 0;
}

export function vendorNamesClose(a: string, b: string): boolean {
  return vendorNameScore(a, b) >= 70;
}

async function findVendorByName(name: string) {
  const exact = await prisma.vendor.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (exact) return exact;
  const candidates = await prisma.vendor.findMany({
    select: { id: true, name: true, isActive: true },
    take: 400,
  });
  const ranked = candidates
    .map((row) => ({ row, score: vendorNameScore(name, row.name) }))
    .filter((hit) => hit.score >= 70)
    .sort((a, b) => b.score - a.score || Number(b.row.isActive) - Number(a.row.isActive));
  if (ranked.length === 0) return null;
  if (ranked.length > 1 && ranked[0]!.score - ranked[1]!.score < 10 && ranked[0]!.score < 100) {
    return null;
  }
  return { id: ranked[0]!.row.id };
}

export function cleanVendorPhone(raw?: string | null): string | null {
  if (!raw?.trim()) return null;
  const fromWhole = normalizeCustomerPhone(raw);
  if (/^[6-9]\d{9}$/.test(fromWhole)) return fromWhole;
  const mobile = raw.match(/(?:\+91[\s-]*)?[6-9]\d{9}/);
  if (mobile) {
    const n = normalizeCustomerPhone(mobile[0]);
    if (/^[6-9]\d{9}$/.test(n)) return n;
  }
  const digits = fromWhole.replace(/\D/g, "");
  if (digits.length >= 8 && digits.length <= 12) return fromWhole.slice(0, 20);
  return null;
}

export function cleanVendorAddress(raw?: string | null): string | null {
  const t = raw?.replace(/\s+/g, " ").trim() ?? "";
  if (t.length < 8 || /\bkeyafe\b/i.test(t)) return null;
  return t.slice(0, 400);
}

/** Fill blank vendor fields only — never overwrite a value staff already set. */
export async function fillVendorBlanks(
  id: string,
  patch: { gstin?: string | null; phone?: string | null; address?: string | null },
) {
  const gstin = patch.gstin ?? null;
  const phone = patch.phone ?? null;
  const address = patch.address ?? null;
  if (!gstin && !phone && !address) return;
  const row = await prisma.vendor.findUnique({
    where: { id },
    select: { gstin: true, phone: true, address: true },
  });
  if (!row) return;
  const data: { gstin?: string; phone?: string; address?: string } = {};
  if (gstin && !row.gstin?.trim()) data.gstin = gstin;
  if (phone && !row.phone?.trim()) data.phone = phone;
  if (address && !row.address?.trim()) data.address = address;
  if (Object.keys(data).length === 0) return;
  await prisma.vendor.update({ where: { id }, data });
}

export async function resolveVendor(input: {
  id?: string;
  name?: string;
  phone?: string | null;
  channel?: "ONLINE" | "OFFLINE";
  gstin?: string | null;
  address?: string | null;
}) {
  const gstin = cleanVendorGstin(input.gstin);
  const phone = cleanVendorPhone(input.phone);
  const address = cleanVendorAddress(input.address);
  const blanks = { gstin, phone, address };
  if (input.id) {
    const existing = await prisma.vendor.findUnique({
      where: { id: input.id },
      select: { id: true },
    });
    if (!existing) throw HttpError.badRequest("Vendor not found");
    if (input.channel) {
      await prisma.vendor.update({
        where: { id: existing.id },
        data: { channel: input.channel },
      });
    }
    await fillVendorBlanks(existing.id, blanks);
    return existing.id;
  }
  if (gstin) {
    const byGstin = await prisma.vendor.findFirst({
      where: { gstin },
      select: { id: true },
    });
    if (byGstin) {
      if (input.channel) {
        await prisma.vendor.update({
          where: { id: byGstin.id },
          data: { channel: input.channel },
        });
      }
      await fillVendorBlanks(byGstin.id, blanks);
      return byGstin.id;
    }
  }
  const name = input.name?.trim();
  if (!name) throw HttpError.badRequest("Pick or type a vendor");
  const byName = await findVendorByName(name);
  if (byName) {
    if (input.channel) {
      await prisma.vendor.update({
        where: { id: byName.id },
        data: { channel: input.channel },
      });
    }
    await fillVendorBlanks(byName.id, blanks);
    return byName.id;
  }
  if (phone) {
    const byPhone = await prisma.vendor.findFirst({
      where: { phone: { in: phoneLookupVariants(phone) } },
      select: { id: true },
    });
    if (byPhone) {
      if (input.channel) {
        await prisma.vendor.update({
          where: { id: byPhone.id },
          data: { channel: input.channel },
        });
      }
      await fillVendorBlanks(byPhone.id, blanks);
      return byPhone.id;
    }
  }
  const created = await prisma.vendor.create({
    data: {
      name,
      phone,
      channel: input.channel ?? "OFFLINE",
      gstin,
      address,
    },
    select: { id: true },
  });
  return created.id;
}

function packSizeOrNull(raw?: number | null) {
  if (raw === undefined || raw === null) return null;
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n) || n < 1) return null;
  return n;
}

export async function resolveBuyItem(input: {
  id?: string;
  name?: string;
  unit?: string;
  packSize?: number | null;
  categoryId?: string | null;
}) {
  const packSize = packSizeOrNull(input.packSize);
  if (input.id) {
    const existing = await prisma.buyItem.findUnique({
      where: { id: input.id },
      select: buyItemSelect,
    });
    if (!existing) throw HttpError.badRequest("Item not found");
    if (packSize && !existing.packSize) {
      return prisma.buyItem.update({
        where: { id: existing.id },
        data: { packSize },
        select: buyItemSelect,
      });
    }
    return existing;
  }
  const name = input.name?.trim();
  if (!name) throw HttpError.badRequest("Pick or type an item");
  if (isShippingChargeName(name)) {
    throw HttpError.badRequest("Delivery charge is a field on the buy, not an item");
  }
  if (isMiscChargeName(name)) {
    throw HttpError.badRequest("Handling and other extras are miscellaneous charges, not an item");
  }
  const nameNormalized = normalizeItemName(name);
  const existing = await prisma.buyItem.findUnique({
    where: { nameNormalized },
    select: buyItemSelect,
  });
  if (existing) {
    if (packSize && !existing.packSize) {
      return prisma.buyItem.update({
        where: { id: existing.id },
        data: { packSize },
        select: buyItemSelect,
      });
    }
    return existing;
  }
  const unit = input.unit;
  if (!unit || !BUY_ITEM_UNITS.has(unit)) {
    throw HttpError.badRequest("Choose a unit for the new item (kg, L, pcs, packet)");
  }
  return prisma.buyItem.create({
    data: {
      name,
      nameNormalized,
      unit: unit as "KG" | "L" | "PCS" | "PACKET",
      packSize,
      categoryId: input.categoryId ?? null,
    },
    select: buyItemSelect,
  });
}

export function serializePayer(row: { id: string; name: string; sortOrder?: number }) {
  return { id: row.id, name: row.name };
}

export function normalizePayerName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function listBooksPayers() {
  const items = await prisma.booksPayer.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
  return { items: items.map(serializePayer) };
}

export async function createBooksPayer(name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw HttpError.badRequest("Name is required");
  const nameNormalized = normalizePayerName(trimmed);
  const existing = await prisma.booksPayer.findUnique({ where: { nameNormalized } });
  if (existing) {
    if (!existing.isActive) {
      const restored = await prisma.booksPayer.update({
        where: { id: existing.id },
        data: { isActive: true, name: trimmed },
      });
      return serializePayer(restored);
    }
    return serializePayer(existing);
  }
  const last = await prisma.booksPayer.aggregate({ _max: { sortOrder: true } });
  const created = await prisma.booksPayer.create({
    data: {
      name: trimmed,
      nameNormalized,
      sortOrder: (last._max.sortOrder ?? -1) + 1,
    },
  });
  return serializePayer(created);
}

export async function resolvePayer(raw?: string | null) {
  if (!raw?.trim()) return null;
  const value = raw.trim();
  const byId = await prisma.booksPayer.findFirst({
    where: { OR: [{ id: value }, { nameNormalized: normalizePayerName(value) }], isActive: true },
    select: { id: true },
  });
  if (byId) return byId.id;
  throw HttpError.badRequest("Unknown person — add them first");
}

export async function resolveCategory(slugOrId: string) {
  const row = await prisma.expenseCategory.findFirst({
    where: {
      OR: [{ id: slugOrId }, { slug: slugOrId }],
      isActive: true,
    },
  });
  if (!row) throw HttpError.badRequest("Unknown expense category");
  return row;
}

export function slugifyCategory(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "category";
}

export function serializeCategory(row: {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
  marketing: boolean;
  requiresNote: boolean;
}) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    sortOrder: row.sortOrder,
    marketing: row.marketing,
    requiresNote: row.requiresNote,
  };
}

export async function createExpenseCategory(name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw HttpError.badRequest("Category name is required");
  const base = slugifyCategory(trimmed);
  const existingByName = await prisma.expenseCategory.findFirst({
    where: { name: { equals: trimmed, mode: "insensitive" } },
  });
  if (existingByName) {
    if (!existingByName.isActive) {
      const restored = await prisma.expenseCategory.update({
        where: { id: existingByName.id },
        data: { isActive: true },
      });
      return serializeCategory(restored);
    }
    return serializeCategory(existingByName);
  }
  let slug = base;
  let n = 2;
  while (await prisma.expenseCategory.findUnique({ where: { slug } })) {
    slug = `${base}-${n}`;
    n += 1;
  }
  const last = await prisma.expenseCategory.aggregate({ _max: { sortOrder: true } });
  const created = await prisma.expenseCategory.create({
    data: {
      name: trimmed,
      slug,
      sortOrder: (last._max.sortOrder ?? 0) + 1,
    },
  });
  return serializeCategory(created);
}

type LineInput = {
  buyItemId?: string;
  name?: string;
  unit?: string;
  packSize?: number | null;
  category?: string;
  qty: number;
  unitPrice: number;
  purpose?: PurchasePurpose;
};

async function categoryIdForLine(
  line: LineInput,
  item: { id: string; categoryId: string | null },
) {
  if (line.category) return (await resolveCategory(line.category)).id;
  if (item.categoryId) return item.categoryId;
  return (await resolveCategory("raw-materials")).id;
}

function primaryCategoryId(lines: { categoryId: string; amount: number }[]) {
  const sums = new Map<string, number>();
  for (const line of lines) {
    sums.set(line.categoryId, roundMoney((sums.get(line.categoryId) ?? 0) + line.amount));
  }
  let best = lines[0]?.categoryId;
  let max = -1;
  for (const [id, amt] of sums) {
    if (amt > max) {
      max = amt;
      best = id;
    }
  }
  if (!best) throw HttpError.badRequest("Missing category");
  return best;
}

export async function buildLines(lines: LineInput[], purchasePurpose: PurchasePurpose) {
  if (lines.length === 0) throw HttpError.badRequest("Add at least one line");
  const resolved = [];
  let total = 0;
  for (const line of lines) {
    if (!(line.qty > 0)) throw HttpError.badRequest("Qty must be more than 0");
    if (!(line.unitPrice >= 0)) throw HttpError.badRequest("Rate cannot be negative");
    const hinted = line.category ? (await resolveCategory(line.category)).id : undefined;
    const item = await resolveBuyItem({
      id: line.buyItemId,
      name: line.name,
      unit: line.unit,
      packSize: line.packSize,
      categoryId: hinted,
    });
    const categoryId = hinted ?? (await categoryIdForLine(line, item));
    if (!item.categoryId) {
      await prisma.buyItem.update({
        where: { id: item.id },
        data: { categoryId },
        select: { id: true },
      });
    }
    const amount = roundMoney(line.qty * line.unitPrice);
    total = roundMoney(total + amount);
    resolved.push({
      buyItemId: item.id,
      categoryId,
      qty: line.qty,
      unitPrice: roundMoney(line.unitPrice),
      amount,
      purpose: line.purpose ?? purchasePurpose,
    });
  }
  return { lines: resolved, total };
}

function moneyOrZero(raw?: number | null) {
  if (raw === undefined || raw === null) return 0;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0)
    throw HttpError.badRequest("Charge cannot be negative");
  return roundMoney(n);
}

export async function createPurchase(input: {
  date: Date;
  vendorId: string;
  purpose: PurchasePurpose;
  paymentMethod: BooksPaymentMethod;
  notes: string | null;
  shipping?: number;
  miscCharges?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  gst?: number;
  categoryId?: string;
  createdByUserId: string;
  paidById?: string | null;
  lines: LineInput[];
}) {
  const built = await buildLines(input.lines, input.purpose);
  const categoryId = input.categoryId ?? primaryCategoryId(built.lines);
  const category = await prisma.expenseCategory.findUnique({ where: { id: categoryId } });
  if (!category) throw HttpError.badRequest("Unknown expense category");
  const shipping = moneyOrZero(input.shipping);
  const miscCharges = moneyOrZero(input.miscCharges);
  const tax = gstParts(input);
  const total = roundMoney(built.total + shipping + miscCharges);
  const purpose = purposeFromPurchase(input.purpose);

  const created = await prisma.$transaction(async (tx) => {
    const purchase = await tx.purchase.create({
      data: {
        date: input.date,
        vendorId: input.vendorId,
        purpose: input.purpose,
        paymentMethod: input.paymentMethod,
        notes: input.notes,
        shipping,
        miscCharges,
        cgst: tax.cgst,
        sgst: tax.sgst,
        igst: tax.igst,
        total,
        createdByUserId: input.createdByUserId,
        paidById: input.paidById ?? null,
        lines: { create: built.lines },
      },
      include: purchaseInclude,
    });
    await tx.expense.create({
      data: {
        date: input.date,
        amount: total,
        cgst: tax.cgst,
        sgst: tax.sgst,
        igst: tax.igst,
        categoryId: category.id,
        purpose,
        vendorId: input.vendorId,
        paymentMethod: input.paymentMethod,
        notes: input.notes,
        createdByUserId: input.createdByUserId,
        paidById: input.paidById ?? null,
        purchaseId: purchase.id,
      },
    });
    return tx.purchase.findUniqueOrThrow({
      where: { id: purchase.id },
      include: purchaseInclude,
    });
  });
  return serializePurchase(created);
}

export async function updatePurchase(
  id: string,
  input: {
    date?: Date;
    vendorId?: string;
    purpose?: PurchasePurpose;
    paymentMethod?: BooksPaymentMethod;
    notes?: string | null;
    shipping?: number;
    miscCharges?: number;
    cgst?: number;
    sgst?: number;
    igst?: number;
    gst?: number;
    categoryId?: string;
    paidById?: string | null;
    lines?: LineInput[];
  },
) {
  const existing = await prisma.purchase.findUnique({
    where: { id },
    include: { expense: true, lines: true },
  });
  if (!existing) throw HttpError.notFound("Buy not found");
  if (existing.voidedAt) throw HttpError.badRequest("This buy is voided");

  const purpose = input.purpose ?? existing.purpose;
  const built = input.lines ? await buildLines(input.lines, purpose) : null;
  const date = input.date ?? existing.date;
  const vendorId = input.vendorId ?? existing.vendorId;
  const paymentMethod = input.paymentMethod ?? existing.paymentMethod;
  const notes = input.notes === undefined ? existing.notes : input.notes;
  const shipping =
    input.shipping !== undefined ? moneyOrZero(input.shipping) : money(existing.shipping);
  const miscCharges =
    input.miscCharges !== undefined ? moneyOrZero(input.miscCharges) : money(existing.miscCharges);
  const tax = gstParts({
    cgst: input.cgst !== undefined ? input.cgst : money(existing.cgst ?? 0),
    sgst: input.sgst !== undefined ? input.sgst : money(existing.sgst ?? 0),
    igst: input.igst !== undefined ? input.igst : money(existing.igst ?? 0),
    gst: input.gst,
  });
  const goods = built
    ? built.total
    : roundMoney(existing.lines.reduce((sum, line) => sum + money(line.amount), 0));
  const total = roundMoney(goods + shipping + miscCharges);
  const categoryId =
    input.categoryId ??
    (built ? primaryCategoryId(built.lines) : existing.expense?.categoryId);
  if (!categoryId) throw HttpError.badRequest("Missing category");
  const paidById = input.paidById !== undefined ? input.paidById : existing.paidById;

  const updated = await prisma.$transaction(async (tx) => {
    if (built) {
      await tx.purchaseLine.deleteMany({ where: { purchaseId: id } });
    }
    await tx.purchase.update({
      where: { id },
      data: {
        date,
        vendorId,
        purpose,
        paymentMethod,
        notes,
        shipping,
        miscCharges,
        cgst: tax.cgst,
        sgst: tax.sgst,
        igst: tax.igst,
        total,
        paidById,
        ...(built ? { lines: { create: built.lines } } : {}),
      },
    });
    if (existing.expense) {
      await tx.expense.update({
        where: { id: existing.expense.id },
        data: {
          date,
          amount: total,
          cgst: tax.cgst,
          sgst: tax.sgst,
          igst: tax.igst,
          categoryId,
          purpose: purposeFromPurchase(purpose),
          vendorId,
          paymentMethod,
          notes,
          paidById,
        },
      });
    }
    return tx.purchase.findUniqueOrThrow({ where: { id }, include: purchaseInclude });
  });
  return serializePurchase(updated);
}

export async function voidPurchase(id: string) {
  const existing = await prisma.purchase.findUnique({
    where: { id },
    include: { expense: true },
  });
  if (!existing) throw HttpError.notFound("Buy not found");
  if (existing.voidedAt)
    return serializePurchase(
      await prisma.purchase.findUniqueOrThrow({ where: { id }, include: purchaseInclude }),
    );
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.purchase.update({ where: { id }, data: { voidedAt: now } });
    if (existing.expense && !existing.expense.voidedAt) {
      await tx.expense.update({ where: { id: existing.expense.id }, data: { voidedAt: now } });
    }
  });
  return serializePurchase(
    await prisma.purchase.findUniqueOrThrow({ where: { id }, include: purchaseInclude }),
  );
}

export async function voidExpense(id: string) {
  const existing = await prisma.expense.findUnique({
    where: { id },
    select: { id: true, purchaseId: true, orderId: true, voidedAt: true },
  });
  if (!existing) throw HttpError.notFound("Expense not found");
  if (existing.purchaseId) {
    await voidPurchase(existing.purchaseId);
    return getExpense(id);
  }
  if (!existing.voidedAt) {
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.expense.update({ where: { id }, data: { voidedAt: now } });
      if (existing.orderId) {
        await tx.order.update({
          where: { id: existing.orderId },
          data: { deliveryCost: null, deliveryPaidById: null },
        });
      }
    });
  }
  return getExpense(id);
}

export async function getPurchase(id: string) {
  const row = await prisma.purchase.findUnique({ where: { id }, include: purchaseInclude });
  if (!row) throw HttpError.notFound("Buy not found");
  return serializePurchase(row);
}

export async function booksMaskSalaries() {
  const row = await prisma.businessSettings.findFirst({
    select: { maskSalaries: true },
  });
  return Boolean(row?.maskSalaries);
}

export function serializeExpense(row: {
  id: string;
  date: Date;
  amount: { toString(): string } | number;
  categoryId: string;
  purpose: string;
  vendorId: string | null;
  paidTo?: string | null;
  paymentMethod: string;
  notes: string | null;
  cgst?: { toString(): string } | number;
  sgst?: { toString(): string } | number;
  igst?: { toString(): string } | number;
  createdByUserId: string;
  paidById?: string | null;
  paidBy?: { id: string; name: string } | null;
  purchaseId: string | null;
  orderId?: string | null;
  voidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  category: {
    id: string;
    slug: string;
    name: string;
    marketing: boolean;
    requiresNote: boolean;
  };
  vendor: { id: string; name: string; phone: string | null; channel?: string } | null;
  purchase:
    | {
        id: string;
        shipping?: { toString(): string } | number;
        miscCharges?: { toString(): string } | number;
        cgst?: { toString(): string } | number;
        sgst?: { toString(): string } | number;
        igst?: { toString(): string } | number;
        lines?: { qty: { toString(): string } | number; buyItem: { name: string } }[];
      }
    | null;
  order?: { id: string; orderNumber: string } | null;
}, opts?: { maskSalaries?: boolean }) {
  const lines = row.purchase?.lines ?? [];
  const hideSalary = Boolean(opts?.maskSalaries && isSalaryCategory(row.category));
  return {
    id: row.id,
    date: dateKey(row.date),
    amount: hideSalary ? null : money(row.amount),
    amountMasked: hideSalary,
    categoryId: row.categoryId,
    category: row.category,
    purpose: row.purpose,
    vendorId: row.vendorId,
    vendor: vendorBrief(row.vendor),
    paidTo: hideSalary ? null : row.paidTo ?? null,
    paymentMethod: row.paymentMethod,
    notes: row.notes,
    cgst: hideSalary ? 0 : money(row.cgst ?? row.purchase?.cgst ?? 0),
    sgst: hideSalary ? 0 : money(row.sgst ?? row.purchase?.sgst ?? 0),
    igst: hideSalary ? 0 : money(row.igst ?? row.purchase?.igst ?? 0),
    gst: hideSalary
      ? 0
      : money(
          money(row.cgst ?? row.purchase?.cgst ?? 0) +
            money(row.sgst ?? row.purchase?.sgst ?? 0) +
            money(row.igst ?? row.purchase?.igst ?? 0),
        ),
    createdByUserId: row.createdByUserId,
    paidById: row.paidById ?? row.paidBy?.id ?? null,
    paidBy: payerBrief(row.paidBy),
    purchaseId: row.purchaseId,
    orderId: row.orderId ?? row.order?.id ?? null,
    order: row.order ? { id: row.order.id, orderNumber: row.order.orderNumber } : null,
    buy: row.purchase
      ? {
          lineCount: lines.length,
          items: lines.map((l) => l.buyItem.name),
          shipping: money(row.purchase.shipping ?? 0),
          miscCharges: money(row.purchase.miscCharges ?? 0),
          gst: money(
            money(row.purchase.cgst ?? 0) +
              money(row.purchase.sgst ?? 0) +
              money(row.purchase.igst ?? 0),
          ),
        }
      : null,
    voidedAt: row.voidedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getExpense(id: string) {
  const [row, maskSalaries] = await Promise.all([
    prisma.expense.findUnique({ where: { id }, include: expenseInclude }),
    booksMaskSalaries(),
  ]);
  if (!row) throw HttpError.notFound("Expense not found");
  return serializeExpense(row, { maskSalaries });
}

export function purchaseListWhere(opts: {
  vendorId?: string;
  buyItemId?: string;
  purpose?: PurchasePurpose;
  from?: Date;
  to?: Date;
  includeVoided?: boolean;
}): Prisma.PurchaseWhereInput {
  const where: Prisma.PurchaseWhereInput = {};
  if (!opts.includeVoided) where.voidedAt = null;
  if (opts.vendorId) where.vendorId = opts.vendorId;
  if (opts.purpose) where.purpose = opts.purpose;
  if (opts.from || opts.to) {
    where.date = {
      ...(opts.from ? { gte: opts.from } : {}),
      ...(opts.to ? { lte: opts.to } : {}),
    };
  }
  if (opts.buyItemId) where.lines = { some: { buyItemId: opts.buyItemId } };
  return where;
}

export function expenseListWhere(opts: {
  category?: string;
  purpose?: string;
  from?: Date;
  to?: Date;
  q?: string;
  kind?: "ALL" | "BUYS" | "OTHER";
  includeVoided?: boolean;
}): Prisma.ExpenseWhereInput {
  const where: Prisma.ExpenseWhereInput = {};
  if (!opts.includeVoided) where.voidedAt = null;
  if (opts.purpose === "TRIAL") where.purpose = "TRIAL";
  else if (opts.purpose) where.purpose = opts.purpose as ExpensePurpose;
  if (opts.kind === "BUYS") where.purchaseId = { not: null };
  if (opts.kind === "OTHER") where.purchaseId = null;
  if (opts.category) {
    const catMatch = { OR: [{ id: opts.category }, { slug: opts.category }] };
    const misc = opts.category === "miscellaneous";
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      {
        OR: [
          { purchaseId: null, category: catMatch },
          { purchase: { lines: { some: { category: catMatch } } } },
          ...(misc
            ? [
                {
                  purchase: {
                    OR: [{ shipping: { gt: 0 } }, { miscCharges: { gt: 0 } }],
                  },
                },
              ]
            : []),
        ],
      },
    ];
  }
  if (opts.from || opts.to) {
    where.date = {
      ...(opts.from ? { gte: opts.from } : {}),
      ...(opts.to ? { lte: opts.to } : {}),
    };
  }
  if (opts.q) {
    where.OR = [
      { notes: { contains: opts.q, mode: "insensitive" } },
      { vendor: { name: { contains: opts.q, mode: "insensitive" } } },
      { vendor: { phone: { contains: opts.q } } },
      { category: { name: { contains: opts.q, mode: "insensitive" } } },
      {
        purchase: {
          lines: { some: { buyItem: { name: { contains: opts.q, mode: "insensitive" } } } },
        },
      },
      { order: { orderNumber: { contains: opts.q, mode: "insensitive" } } },
      { paidBy: { name: { contains: opts.q, mode: "insensitive" } } },
      { paidTo: { contains: opts.q, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function syncOrderDeliveryExpense(input: {
  orderId: string;
  orderNumber: string;
  deliveryCost: number | null;
  shopDate: Date;
  createdByUserId: string;
  paidById?: string | null;
}) {
  await prisma.expenseCategory.upsert({
    where: { slug: "delivery" },
    create: { slug: "delivery", name: "Delivery", sortOrder: 5 },
    update: {},
  });
  const category = await resolveCategory("delivery");
  const existing = await prisma.expense.findUnique({
    where: { orderId: input.orderId },
    select: { id: true, voidedAt: true },
  });
  const amount =
    input.deliveryCost !== null && input.deliveryCost > 0 ? roundMoney(input.deliveryCost) : 0;
  const notes = `Order ${input.orderNumber} delivery`;

  if (amount <= 0) {
    if (existing && !existing.voidedAt) {
      await prisma.expense.update({
        where: { id: existing.id },
        data: { voidedAt: new Date() },
      });
    }
    return;
  }

  if (existing) {
    await prisma.expense.update({
      where: { id: existing.id },
      data: {
        date: input.shopDate,
        amount,
        categoryId: category.id,
        purpose: "OPS",
        notes,
        voidedAt: null,
        ...(input.paidById !== undefined ? { paidById: input.paidById } : {}),
      },
    });
    return;
  }

  await prisma.expense.create({
    data: {
      date: input.shopDate,
      amount,
      categoryId: category.id,
      purpose: "OPS",
      paymentMethod: "UPI",
      notes,
      createdByUserId: input.createdByUserId,
      paidById: input.paidById ?? null,
      orderId: input.orderId,
    },
  });
}
