import type { ExpensePurpose, Prisma, PurchasePurpose } from "@prisma/client";
import { HttpError } from "../../utils/httpError.js";
import { roundMoney } from "../coupons/coupon.service.js";
import type { AuthenticatedRequest } from "../../middleware/auth.js";
import { staffHasPermission } from "../../middleware/auth.js";

export const BUY_ITEM_UNITS = ["KG", "L", "PCS", "PACKET"] as const;
export const PURCHASE_PURPOSES = ["PRODUCTION", "TRIAL", "WASTE"] as const;
export const EXPENSE_PURPOSES = ["PRODUCTION", "TRIAL", "WASTE", "OPS", "MARKETING"] as const;
export const BOOKS_PAY_METHODS = ["CASH", "UPI", "BANK"] as const;
export const VENDOR_CHANNELS = ["OFFLINE", "ONLINE"] as const;

export function pageParams(query: { page?: unknown; pageSize?: unknown }) {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
  return { page, pageSize, skip: (page - 1) * pageSize };
}

export function pageJson<T>(items: T[], total: number, page: number, pageSize: number) {
  return {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function parseDateKey(raw: string): Date {
  const s = raw.trim();
  if (!DATE_KEY.test(s)) throw HttpError.badRequest("Date must be YYYY-MM-DD");
  return new Date(`${s}T00:00:00.000Z`);
}

export function optionalDateKey(raw: unknown): Date | undefined {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  return parseDateKey(raw);
}

export function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function money(n: number | string | { toString(): string }): number {
  return roundMoney(Number(n));
}

export function qtyNum(n: number | string | { toString(): string }): number {
  return Math.round((Number(n) + Number.EPSILON) * 1000) / 1000;
}

export function normalizeItemName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isShippingChargeName(name: string): boolean {
  const n = normalizeItemName(name);
  return (
    n.includes("shipping") ||
    n === "delivery charge" ||
    n === "delivery charges" ||
    n === "delhivery"
  );
}

export function requireBooksWrite(req: AuthenticatedRequest) {
  const staff = req.staff;
  if (!staff || !staffHasPermission(staff, "expenses.write")) {
    throw HttpError.forbidden("You don't have permission to edit books");
  }
  return staff;
}

export function staffId(req: AuthenticatedRequest): string {
  const id = req.staff?.id ?? req.user?.id;
  if (!id) throw HttpError.unauthorized();
  return id;
}

export function purposeFromPurchase(purpose: PurchasePurpose): ExpensePurpose {
  return purpose;
}

export function payerBrief(p: { id: string; name: string } | null | undefined) {
  if (!p) return null;
  return { id: p.id, name: p.name };
}

export function vendorBrief(
  v: { id: string; name: string; phone: string | null; channel?: string } | null,
) {
  if (!v) return null;
  return { id: v.id, name: v.name, phone: v.phone, channel: v.channel ?? "OFFLINE" };
}

export function categoryBrief(c: {
  id: string;
  slug: string;
  name: string;
  marketing: boolean;
  requiresNote: boolean;
}) {
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    marketing: c.marketing,
    requiresNote: c.requiresNote,
  };
}

export const buyItemSelect = {
  id: true,
  name: true,
  nameNormalized: true,
  unit: true,
  packSize: true,
  isActive: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.BuyItemSelect;

export const purchaseInclude = {
  vendor: { select: { id: true, name: true, phone: true, channel: true } },
  lines: {
    orderBy: { id: "asc" as const },
    include: { buyItem: { select: { id: true, name: true, unit: true, packSize: true } } },
  },
  expense: { select: { id: true, categoryId: true } },
  paidBy: { select: { id: true, name: true } },
} satisfies Prisma.PurchaseInclude;

export const expenseInclude = {
  category: {
    select: { id: true, slug: true, name: true, marketing: true, requiresNote: true },
  },
  vendor: { select: { id: true, name: true, phone: true, channel: true } },
  purchase: {
    select: {
      id: true,
      shipping: true,
      lines: {
        orderBy: { id: "asc" as const },
        select: { qty: true, buyItem: { select: { name: true } } },
      },
    },
  },
  order: { select: { id: true, orderNumber: true } },
  paidBy: { select: { id: true, name: true } },
} satisfies Prisma.ExpenseInclude;
