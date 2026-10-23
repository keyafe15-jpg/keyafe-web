import type { BooksPaymentMethod, ExpensePurpose, Prisma, PurchasePurpose } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";
import { roundMoney } from "../coupons/coupon.service.js";
import {
  buyItemSelect,
  dateKey,
  expenseInclude,
  money,
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
    qty: { toString(): string } | number;
    unitPrice: { toString(): string } | number;
    amount: { toString(): string } | number;
    purpose: PurchasePurpose | null;
    buyItem: { id: string; name: string; unit: string; packSize: number | null };
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
      buyItem: {
        id: line.buyItem.id,
        name: line.buyItem.name,
        unit: line.buyItem.unit,
        packSize: line.buyItem.packSize,
      },
      qty: qtyNum(line.qty),
      unitPrice: money(line.unitPrice),
      amount: money(line.amount),
      purpose: line.purpose,
    })),
  };
}

export async function resolveVendor(input: {
  id?: string;
  name?: string;
  phone?: string | null;
  channel?: "ONLINE" | "OFFLINE";
}) {
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
    return existing.id;
  }
  const name = input.name?.trim();
  if (!name) throw HttpError.badRequest("Pick or type a vendor");
  const phone = input.phone?.trim() || null;
  if (phone) {
    const byPhone = await prisma.vendor.findFirst({
      where: { phone },
      select: { id: true },
    });
    if (byPhone) {
      if (input.channel) {
        await prisma.vendor.update({
          where: { id: byPhone.id },
          data: { channel: input.channel },
        });
      }
      return byPhone.id;
    }
  }
  const created = await prisma.vendor.create({
    data: { name, phone, channel: input.channel ?? "OFFLINE" },
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
  qty: number;
  unitPrice: number;
  purpose?: PurchasePurpose;
};

export async function buildLines(lines: LineInput[], purchasePurpose: PurchasePurpose) {
  if (lines.length === 0) throw HttpError.badRequest("Add at least one line");
  const resolved = [];
  let total = 0;
  for (const line of lines) {
    if (!(line.qty > 0)) throw HttpError.badRequest("Qty must be more than 0");
    if (!(line.unitPrice >= 0)) throw HttpError.badRequest("Rate cannot be negative");
    const item = await resolveBuyItem({
      id: line.buyItemId,
      name: line.name,
      unit: line.unit,
      packSize: line.packSize,
    });
    const amount = roundMoney(line.qty * line.unitPrice);
    total = roundMoney(total + amount);
    resolved.push({
      buyItemId: item.id,
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
    throw HttpError.badRequest("Delivery charge cannot be negative");
  return roundMoney(n);
}

export async function createPurchase(input: {
  date: Date;
  vendorId: string;
  purpose: PurchasePurpose;
  paymentMethod: BooksPaymentMethod;
  notes: string | null;
  shipping?: number;
  categoryId: string;
  createdByUserId: string;
  paidById?: string | null;
  lines: LineInput[];
}) {
  const category = await prisma.expenseCategory.findUnique({ where: { id: input.categoryId } });
  if (!category) throw HttpError.badRequest("Unknown expense category");
  const built = await buildLines(input.lines, input.purpose);
  const shipping = moneyOrZero(input.shipping);
  const total = roundMoney(built.total + shipping);
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
        categoryId: input.categoryId,
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
  const goods = built
    ? built.total
    : roundMoney(existing.lines.reduce((sum, line) => sum + money(line.amount), 0));
  const total = roundMoney(goods + shipping);
  const categoryId = input.categoryId ?? existing.expense?.categoryId;
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

export async function getPurchase(id: string) {
  const row = await prisma.purchase.findUnique({ where: { id }, include: purchaseInclude });
  if (!row) throw HttpError.notFound("Buy not found");
  return serializePurchase(row);
}

export function serializeExpense(row: {
  id: string;
  date: Date;
  amount: { toString(): string } | number;
  categoryId: string;
  purpose: string;
  vendorId: string | null;
  paymentMethod: string;
  notes: string | null;
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
        lines?: { qty: { toString(): string } | number; buyItem: { name: string } }[];
      }
    | null;
  order?: { id: string; orderNumber: string } | null;
}) {
  const lines = row.purchase?.lines ?? [];
  return {
    id: row.id,
    date: dateKey(row.date),
    amount: money(row.amount),
    categoryId: row.categoryId,
    category: row.category,
    purpose: row.purpose,
    vendorId: row.vendorId,
    vendor: vendorBrief(row.vendor),
    paymentMethod: row.paymentMethod,
    notes: row.notes,
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
        }
      : null,
    voidedAt: row.voidedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getExpense(id: string) {
  const row = await prisma.expense.findUnique({ where: { id }, include: expenseInclude });
  if (!row) throw HttpError.notFound("Expense not found");
  return serializeExpense(row);
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
    where.category = { OR: [{ id: opts.category }, { slug: opts.category }] };
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
