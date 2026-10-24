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

export function moneyOrZero(n?: number | string | null): number {
  if (n == null || n === "") return 0;
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) return 0;
  return money(v);
}

/** Prefer the tax-summary split. A lone GST total is treated as intra-state (half CGST / half SGST). */
export function gstParts(input: {
  cgst?: number | null;
  sgst?: number | null;
  igst?: number | null;
  gst?: number | null;
}) {
  let cgst = moneyOrZero(input.cgst);
  let sgst = moneyOrZero(input.sgst);
  let igst = moneyOrZero(input.igst);
  const named = money(cgst + sgst + igst);
  const combined = moneyOrZero(input.gst);
  if (named <= 0 && combined > 0) {
    const half = money(combined / 2);
    cgst = half;
    sgst = money(combined - half);
  }
  return { cgst, sgst, igst, gst: money(cgst + sgst + igst) };
}

export function isGstChargeName(name: string): boolean {
  const n = normalizeItemName(name);
  return (
    n === "gst" ||
    n === "cgst" ||
    n === "sgst" ||
    n === "igst" ||
    n.includes("cgst") ||
    n.includes("sgst") ||
    n.includes("igst") ||
    n.includes("gst amt") ||
    n.includes("gst amount")
  );
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
    n.includes("delivery charge") ||
    n === "delivery" ||
    n === "delhivery" ||
    n === "courier"
  );
}

/** Handling, packing fee, platform fee — extras on the buy, not goods. */
export function isMiscChargeName(name: string): boolean {
  const n = normalizeItemName(name);
  if (isShippingChargeName(n)) return false;
  return (
    n.includes("handling") ||
    n.includes("convenience") ||
    n.includes("platform fee") ||
    n.includes("platform charge") ||
    n.includes("service charge") ||
    n.includes("service fee") ||
    n.includes("processing") ||
    n.includes("surcharge") ||
    n.includes("packing charge") ||
    n.includes("packing fee") ||
    n.includes("packaging charge") ||
    n.includes("packaging fee") ||
    n.includes("extra charge") ||
    n.includes("other charge") ||
    n.includes("miscellaneous") ||
    n.includes("misc charge")
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

export function isSalaryCategory(category: { slug: string } | string) {
  return (typeof category === "string" ? category : category.slug) === "salary";
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

const categoryBriefSelect = { id: true, slug: true, name: true } as const;

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
  categoryId: true,
  category: { select: categoryBriefSelect },
} satisfies Prisma.BuyItemSelect;

export const purchaseInclude = {
  vendor: { select: { id: true, name: true, phone: true, channel: true } },
  lines: {
    orderBy: { id: "asc" as const },
    include: {
      category: { select: categoryBriefSelect },
      buyItem: {
        select: {
          id: true,
          name: true,
          unit: true,
          packSize: true,
          categoryId: true,
          category: { select: categoryBriefSelect },
        },
      },
    },
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
      miscCharges: true,
      cgst: true,
      sgst: true,
      igst: true,
      lines: {
        orderBy: { id: "asc" as const },
        select: { qty: true, buyItem: { select: { name: true } } },
      },
    },
  },
  order: { select: { id: true, orderNumber: true } },
  paidBy: { select: { id: true, name: true } },
} satisfies Prisma.ExpenseInclude;
