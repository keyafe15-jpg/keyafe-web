import { z } from "zod";
import type { Coupon, Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";
import { sendEmail } from "../email/email.service.js";
import { renderCouponShare } from "../email/templates.js";

export function digitsPhone(phone: string): string {
  const raw = phone.replace(/\D/g, "");
  return raw.length > 10 ? raw.slice(-10) : raw;
}

export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Admin-entered discount on offline / order-link carts (not a coupon code). */
export type ManualDiscountType = "FLAT" | "PERCENT";

export function manualDiscountRupees(
  subtotal: number,
  type: ManualDiscountType | null | undefined,
  value: number | null | undefined,
): number {
  if (
    !type ||
    value == null ||
    !Number.isFinite(value) ||
    value <= 0 ||
    subtotal <= 0
  ) {
    return 0;
  }
  if (type === "PERCENT") {
    const pct = Math.min(100, value);
    return roundMoney(Math.min(subtotal, (subtotal * pct) / 100));
  }
  return roundMoney(Math.min(subtotal, value));
}

/** Scale GST snapshots after an items-only discount (delivery is never discounted). */
export function scaleGstForCartDiscount(
  taxable: number,
  cgst: number,
  sgst: number,
  igst: number,
  subtotal: number,
  discount: number,
): {
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
} {
  if (discount <= 0 || subtotal <= 0) {
    return {
      taxableAmount: roundMoney(taxable),
      cgstAmount: roundMoney(cgst),
      sgstAmount: roundMoney(sgst),
      igstAmount: roundMoney(igst),
    };
  }
  const scale = (subtotal - discount) / subtotal;
  return {
    taxableAmount: roundMoney(taxable * scale),
    cgstAmount: roundMoney(cgst * scale),
    sgstAmount: roundMoney(sgst * scale),
    igstAmount: roundMoney(igst * scale),
  };
}

export interface CartLine {
  productId: string;
  unitPrice: number;
  qty: number;
}

export interface CouponQuote {
  code: string;
  discount: number;
  waivesDelivery: boolean;
  label: string;
}

export interface FreeDeliveryState {
  active: boolean;
  from: string | null;
  until: string | null;
  minCart: number | null;
  label: string | null;
}

type ProductCat = { id: string; categoryId: string; name: string };

export function freeDeliveryFromSettings(
  settings: {
    freeDeliveryFrom: Date | null;
    freeDeliveryUntil: Date | null;
    freeDeliveryMinCart: unknown;
  } | null,
  subtotal: number,
  now = new Date(),
): FreeDeliveryState {
  const from = settings?.freeDeliveryFrom ?? null;
  const until = settings?.freeDeliveryUntil ?? null;
  const minCart =
    settings?.freeDeliveryMinCart != null
      ? Number(settings.freeDeliveryMinCart)
      : null;

  const base: FreeDeliveryState = {
    active: false,
    from: from?.toISOString() ?? null,
    until: until?.toISOString() ?? null,
    minCart,
    label: null,
  };

  if (!until) return base;
  if (now.getTime() > until.getTime()) return base;
  if (from && now.getTime() < from.getTime()) return base;
  if (minCart != null && subtotal < minCart) {
    return {
      ...base,
      label: `Free delivery on orders over ₹${minCart.toFixed(0)}`,
    };
  }

  const untilLabel = until.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
  });
  return {
    ...base,
    active: true,
    label: `Free delivery until ${untilLabel}`,
  };
}

export async function getPublicFreeDelivery(subtotal = 0) {
  const settings = await prisma.businessSettings.findFirst({
    select: {
      freeDeliveryFrom: true,
      freeDeliveryUntil: true,
      freeDeliveryMinCart: true,
    },
  });
  return freeDeliveryFromSettings(settings, subtotal);
}

function couponLabel(coupon: Coupon, discount: number): string {
  if (coupon.type === "PERCENT") {
    const pct = Number(coupon.value);
    return `${coupon.code} · ${pct}% off (−₹${discount.toFixed(0)})`;
  }
  return `${coupon.code} · ₹${Number(coupon.value).toFixed(0)} off`;
}

function eligibleAmount(
  items: CartLine[],
  products: Map<string, ProductCat>,
  categoryIds: string[],
): number {
  const restrict = categoryIds.length > 0;
  let sum = 0;
  for (const item of items) {
    const p = products.get(item.productId);
    if (!p) continue;
    if (restrict && !categoryIds.includes(p.categoryId)) continue;
    sum += item.unitPrice * item.qty;
  }
  return roundMoney(sum);
}

function computeDiscount(coupon: Coupon, eligible: number): number {
  if (eligible <= 0) return 0;
  const value = Number(coupon.value);
  let discount =
    coupon.type === "PERCENT" ? (eligible * value) / 100 : Math.min(value, eligible);
  const cap = coupon.maxDiscount != null ? Number(coupon.maxDiscount) : null;
  if (cap != null) discount = Math.min(discount, cap);
  return roundMoney(Math.max(0, Math.min(discount, eligible)));
}

async function loadProducts(items: CartLine[]): Promise<Map<string, ProductCat>> {
  const ids = [...new Set(items.map((i) => i.productId))];
  const rows = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, categoryId: true, name: true },
  });
  return new Map(rows.map((r) => [r.id, r]));
}

export async function quoteCoupon(
  codeRaw: string,
  items: CartLine[],
  customerPhone: string,
  now = new Date(),
): Promise<CouponQuote> {
  const code = codeRaw.trim().toUpperCase();
  if (!code) throw HttpError.badRequest("Enter a coupon code");

  const coupon = await prisma.coupon.findUnique({ where: { code } });
  if (!coupon || !coupon.isActive) {
    throw HttpError.badRequest("This coupon isn’t valid");
  }
  if (now < coupon.validFrom || now > coupon.validUntil) {
    throw HttpError.badRequest("This coupon isn’t valid right now");
  }

  const phone = digitsPhone(customerPhone);
  if (coupon.restrictedToPhone) {
    if (!phone || digitsPhone(coupon.restrictedToPhone) !== phone) {
      throw HttpError.badRequest("This coupon isn’t valid for this number");
    }
  }

  const subtotal = roundMoney(
    items.reduce((s, i) => s + i.unitPrice * i.qty, 0),
  );
  const minCart =
    coupon.minCartAmount != null ? Number(coupon.minCartAmount) : null;
  if (minCart != null && subtotal < minCart) {
    throw HttpError.badRequest(
      `Add ₹${(minCart - subtotal).toFixed(0)} more to use this coupon`,
    );
  }

  if (coupon.totalUsageLimit != null && coupon.usageCount >= coupon.totalUsageLimit) {
    throw HttpError.badRequest("This coupon has been fully used");
  }

  if (coupon.perCustomerLimit != null && phone) {
    const used = await prisma.couponRedemption.count({
      where: { couponCode: code, customerPhone: phone },
    });
    if (used >= coupon.perCustomerLimit) {
      throw HttpError.badRequest("You’ve already used this coupon");
    }
  }

  const products = await loadProducts(items);
  const eligible = eligibleAmount(items, products, coupon.applicableCategoryIds);
  if (eligible <= 0 && Number(coupon.value) > 0) {
    throw HttpError.badRequest("This coupon doesn’t apply to items in your cart");
  }

  const discount = computeDiscount(coupon, eligible);
  if (discount <= 0 && !coupon.waivesDelivery) {
    throw HttpError.badRequest("This coupon doesn’t apply to this cart");
  }

  return {
    code,
    discount,
    waivesDelivery: coupon.waivesDelivery,
    label: couponLabel(coupon, discount),
  };
}

/** Scale eligible inclusive lines so they lose exactly `discount`. */
export function discountedLineInclusives(
  items: CartLine[],
  products: Map<string, ProductCat>,
  categoryIds: string[],
  discount: number,
): number[] {
  const restrict = categoryIds.length > 0;
  const orig = items.map((i) => roundMoney(i.unitPrice * i.qty));
  if (discount <= 0) return orig;

  const flags = items.map((i) => {
    const p = products.get(i.productId);
    if (!p) return false;
    return !restrict || categoryIds.includes(p.categoryId);
  });
  const eligibleSum = roundMoney(
    orig.reduce((s, v, idx) => s + (flags[idx] ? v : 0), 0),
  );
  if (eligibleSum <= 0) return orig;

  const scale = (eligibleSum - discount) / eligibleSum;
  const out = orig.map((v, idx) =>
    flags[idx] ? roundMoney(v * scale) : v,
  );
  const got = roundMoney(
    orig.reduce((s, v, idx) => s + (flags[idx] ? v - (out[idx] ?? 0) : 0), 0),
  );
  const drift = roundMoney(discount - got);
  if (drift !== 0) {
    const idx = flags.lastIndexOf(true);
    if (idx >= 0) out[idx] = roundMoney((out[idx] ?? 0) - drift);
  }
  return out;
}

export async function redeemCouponInTx(
  tx: Prisma.TransactionClient,
  quote: CouponQuote,
  orderId: string,
  customerPhone: string,
) {
  const phone = digitsPhone(customerPhone);
  const coupon = await tx.coupon.findUnique({ where: { code: quote.code } });
  if (!coupon || !coupon.isActive) {
    throw HttpError.badRequest("This coupon isn’t valid");
  }

  if (coupon.totalUsageLimit != null) {
    const bumped = await tx.coupon.updateMany({
      where: {
        code: quote.code,
        usageCount: { lt: coupon.totalUsageLimit },
      },
      data: { usageCount: { increment: 1 } },
    });
    if (bumped.count !== 1) {
      throw HttpError.conflict("This coupon has been fully used");
    }
  } else {
    await tx.coupon.update({
      where: { code: quote.code },
      data: { usageCount: { increment: 1 } },
    });
  }

  if (coupon.perCustomerLimit != null && phone) {
    const used = await tx.couponRedemption.count({
      where: { couponCode: quote.code, customerPhone: phone },
    });
    if (used >= coupon.perCustomerLimit) {
      throw HttpError.conflict("You’ve already used this coupon");
    }
  }

  await tx.couponRedemption.create({
    data: {
      couponCode: quote.code,
      orderId,
      customerPhone: phone || customerPhone,
    },
  });
}

const codeSchema = z
  .string()
  .trim()
  .min(3)
  .max(24)
  .regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, hyphen or underscore")
  .transform((s) => s.toUpperCase());

export const upsertCouponSchema = z.object({
  code: codeSchema,
  type: z.enum(["PERCENT", "FLAT"]),
  value: z.coerce.number().nonnegative(),
  minCartAmount: z.coerce.number().nonnegative().nullable().optional(),
  maxDiscount: z.coerce.number().positive().nullable().optional(),
  applicableCategoryIds: z.array(z.string()).default([]),
  perCustomerLimit: z.coerce.number().int().positive().nullable().optional(),
  totalUsageLimit: z.coerce.number().int().positive().nullable().optional(),
  validFrom: z.coerce.date(),
  validUntil: z.coerce.date(),
  waivesDelivery: z.boolean().default(false),
  restrictedToPhone: z.string().trim().nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
  showOnStorefront: z.boolean().default(false),
  headline: z.string().trim().max(80).nullable().optional(),
  storefrontCopy: z.string().trim().max(240).nullable().optional(),
  isActive: z.boolean().default(true),
});

export type UpsertCouponInput = z.infer<typeof upsertCouponSchema>;

export async function listCoupons() {
  return prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
}

export async function listPublicCoupons(now = new Date()) {
  const rows = await prisma.coupon.findMany({
    where: {
      isActive: true,
      showOnStorefront: true,
      restrictedToPhone: null,
      validFrom: { lte: now },
      validUntil: { gte: now },
    },
    orderBy: { createdAt: "desc" },
    select: {
      code: true,
      type: true,
      value: true,
      headline: true,
      storefrontCopy: true,
      waivesDelivery: true,
      totalUsageLimit: true,
      usageCount: true,
      validUntil: true,
    },
  });

  return rows
    .map((c) => {
      const remaining =
        c.totalUsageLimit != null
          ? Math.max(0, c.totalUsageLimit - c.usageCount)
          : null;
      return {
        code: c.code,
        type: c.type,
        value: Number(c.value),
        headline:
          c.headline?.trim() ||
          (c.type === "PERCENT"
            ? `${Number(c.value)}% off`
            : `₹${Number(c.value)} off`),
        copy: c.storefrontCopy?.trim() || null,
        waivesDelivery: c.waivesDelivery,
        remaining,
        limited: c.totalUsageLimit != null,
        validUntil: c.validUntil.toISOString(),
      };
    })
    .filter((c) => c.remaining == null || c.remaining > 0);
}

export async function upsertCoupon(input: UpsertCouponInput) {
  if (input.type === "PERCENT" && input.value > 100) {
    throw HttpError.badRequest("Percent can’t be over 100");
  }
  if (input.value === 0 && !input.waivesDelivery) {
    throw HttpError.badRequest("Set a discount amount or waive delivery");
  }
  if (input.validUntil <= input.validFrom) {
    throw HttpError.badRequest("End date must be after start date");
  }
  if (input.showOnStorefront && input.restrictedToPhone) {
    throw HttpError.badRequest(
      "A phone-locked coupon can’t be shown on the homepage",
    );
  }
  if (
    input.showOnStorefront &&
    !input.headline?.trim() &&
    !input.storefrontCopy?.trim()
  ) {
    throw HttpError.badRequest(
      "Add a headline or writeup for the homepage banner",
    );
  }
  const data = {
    type: input.type,
    value: input.value,
    minCartAmount: input.minCartAmount ?? null,
    maxDiscount: input.maxDiscount ?? null,
    applicableCategoryIds: input.applicableCategoryIds,
    perCustomerLimit: input.perCustomerLimit ?? null,
    totalUsageLimit: input.totalUsageLimit ?? null,
    validFrom: input.validFrom,
    validUntil: input.validUntil,
    waivesDelivery: input.waivesDelivery,
    restrictedToPhone: input.restrictedToPhone
      ? digitsPhone(input.restrictedToPhone)
      : null,
    note: input.note || null,
    showOnStorefront: input.showOnStorefront,
    headline: input.headline?.trim() || null,
    storefrontCopy: input.storefrontCopy?.trim() || null,
    isActive: input.isActive,
  };
  return prisma.coupon.upsert({
    where: { code: input.code },
    create: { code: input.code, ...data },
    update: data,
  });
}

export async function setCouponActive(code: string, isActive: boolean) {
  try {
    return await prisma.coupon.update({
      where: { code: code.trim().toUpperCase() },
      data: { isActive },
    });
  } catch {
    throw HttpError.notFound("Coupon not found");
  }
}

export const emailCouponSchema = z.object({
  to: z.string().email(),
});

export async function emailCoupon(code: string, to: string) {
  const coupon = await prisma.coupon.findUnique({
    where: { code: code.trim().toUpperCase() },
  });
  if (!coupon) throw HttpError.notFound("Coupon not found");
  const { subject, html } = renderCouponShare(coupon);
  await sendEmail({ to, subject, html });
  return { ok: true };
}

export const updateFreeDeliverySchema = z.object({
  freeDeliveryFrom: z
    .union([z.string(), z.null()])
    .transform((v) => (v ? new Date(v) : null))
    .refine((d) => d === null || !Number.isNaN(d.getTime()), "Invalid from date"),
  freeDeliveryUntil: z
    .union([z.string(), z.null()])
    .transform((v) => (v ? new Date(v) : null))
    .refine((d) => d === null || !Number.isNaN(d.getTime()), "Invalid until date"),
  freeDeliveryMinCart: z.union([z.coerce.number().nonnegative(), z.null()]),
});

export async function updateFreeDelivery(
  input: z.infer<typeof updateFreeDeliverySchema>,
) {
  const existing = await prisma.businessSettings.findFirst({
    select: { id: true },
  });
  if (!existing) throw HttpError.notFound("Business settings not found");
  return prisma.businessSettings.update({
    where: { id: existing.id },
    data: {
      freeDeliveryFrom: input.freeDeliveryFrom,
      freeDeliveryUntil: input.freeDeliveryUntil,
      freeDeliveryMinCart: input.freeDeliveryMinCart,
    },
    select: {
      freeDeliveryFrom: true,
      freeDeliveryUntil: true,
      freeDeliveryMinCart: true,
    },
  });
}

export async function getAdminFreeDelivery() {
  const settings = await prisma.businessSettings.findFirst({
    select: {
      freeDeliveryFrom: true,
      freeDeliveryUntil: true,
      freeDeliveryMinCart: true,
    },
  });
  return {
    freeDeliveryFrom: settings?.freeDeliveryFrom ?? null,
    freeDeliveryUntil: settings?.freeDeliveryUntil ?? null,
    freeDeliveryMinCart:
      settings?.freeDeliveryMinCart != null
        ? Number(settings.freeDeliveryMinCart)
        : null,
  };
}
