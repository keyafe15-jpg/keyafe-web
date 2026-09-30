import { customAlphabet } from "nanoid";
import { z } from "zod";
import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";
import { checkPincode } from "../delivery/delivery.service.js";
import { logger } from "../../utils/logger.js";
import { buildOrderNumber } from "../orders/order.service.js";
import { notifyOrderPlaced } from "../orders/order.notify.js";
import { assertKitchenOpenOn } from "../store/store.service.js";
import { cashfreeEnabled } from "../payments/cashfree.client.js";
import { createPaymentSession } from "../payments/payment.service.js";
import {
  manualDiscountRupees,
  roundMoney,
  type ManualDiscountType,
} from "../coupons/coupon.service.js";
import { ensureCustomerForOrder } from "../customers/customer.service.js";
import {
  allocateCartDiscount,
  computeLineTax,
  getSellerStateCode,
  gstAddedOnTop,
  resolvePlaceOfSupply,
  sumLineTax,
} from "../orders/order.tax.js";
import { buyerGstFields } from "../../lib/gstin.js";
import {
  MAX_PAYMENT_SCREENSHOTS,
  OFFLINE_PAYMENT_METHODS,
  type OfflinePaymentMethod,
} from "../../lib/paymentLabel.js";
import {
  giftBillingFieldsSchema,
  orderAddressSchema,
  resolveGiftBilling,
  type ResolvedGiftBilling,
} from "../orders/order.gift.js";

// 31-char lower-safe alphabet (drops i, l, o, 1, 0 to avoid ambiguity).
const tokenGen = customAlphabet("abcdefghjkmnpqrstuvwxyz23456789", 8);

// GST assumption for custom-cake links (no product to inherit from).
// Standard bakery HSN 1905 → 5% inclusive. Admin can override later.
const CUSTOM_GST_RATE = 5;
const CUSTOM_GST_INCLUSIVE = true;
const CUSTOM_HSN_CODE = "1905";

// Turns a chosen payment mode + raw advance amount into the amount/status/method
// to persist. Used by the admin offline-direct form and by pay-on-delivery links.
// Without an explicit method, any screenshot means staff already verified a manual
// UPI/bank transfer.
function resolvePayment(
  paymentMode: "FULL" | "ADVANCE",
  rawAdvanceAmount: number | undefined,
  total: number,
  hasScreenshot: boolean,
  method?: OfflinePaymentMethod,
) {
  const advanceAmount =
    paymentMode === "FULL" ? total : Math.min(Math.max(rawAdvanceAmount ?? 0, 0), total);
  const paymentStatus =
    advanceAmount <= 0 ? "PENDING" : advanceAmount >= total ? "PAID" : "PARTIAL";
  const paymentMethod = method ?? (hasScreenshot ? "upi" : "cod");
  return { advanceAmount, paymentStatus, paymentMethod } as const;
}

const suggestedSlotSchema = z
  .object({
    date: z.string().optional().nullable(),
    key: z.string().optional().nullable(),
    label: z.string().optional().nullable(),
  })
  .optional()
  .nullable();

const orderLinkItemSchema = z.object({
  kind: z.enum(["CUSTOM", "CATALOG"]),
  productId: z.string().min(1).optional().nullable(),
  productName: z.string().trim().min(2),
  sizeLabel: z.string().trim().nullable().optional(),
  sizeGrams: z.coerce.number().int().positive().nullable().optional(),
  flavourId: z.string().nullable().optional(),
  flavourName: z.string().trim().nullable().optional(),
  referenceImageUrl: z.string().url().nullable().optional(),
  messageHint: z.string().trim().max(200).nullable().optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  unitPrice: z.coerce.number().nonnegative(),
  qty: z.coerce.number().int().positive().default(1),
});
type OrderLinkItemInput = z.infer<typeof orderLinkItemSchema>;

const itemsRefine = (items: OrderLinkItemInput[]) =>
  items.every((i) => (i.kind === "CATALOG" ? !!i.productId : true));

const manualDiscountFields = {
  discountType: z.enum(["FLAT", "PERCENT"]).nullable().optional(),
  discountValue: z.coerce.number().nonnegative().nullable().optional(),
};

function parsedManualDiscount(
  type: ManualDiscountType | null | undefined,
  value: number | null | undefined,
): { discountType: ManualDiscountType | null; discountValue: number | null } {
  if (!type || value == null || !Number.isFinite(value) || value <= 0) {
    return { discountType: null, discountValue: null };
  }
  if (type === "PERCENT" && value > 100) {
    throw HttpError.badRequest("Percent discount cannot exceed 100");
  }
  return { discountType: type, discountValue: value };
}

export const createOrderLinkSchema = z.object({
  items: z
    .array(orderLinkItemSchema)
    .min(1, "Add at least one item")
    .refine(itemsRefine, {
      message: "productId required for CATALOG items",
      path: ["items"],
    }),

  customerName: z.string().trim().nullable().optional(),
  customerPhone: z.string().trim().nullable().optional(),
  suggested: suggestedSlotSchema,

  adminNotes: z.string().trim().max(2000).nullable().optional(),

  expiresInDays: z.coerce.number().int().positive().max(365).nullable().optional(),

  // Optional locked delivery fee for this link (null = use pincode table).
  deliveryFee: z.coerce.number().nonnegative().nullable().optional(),

  allowOnlinePayment: z.boolean().optional().default(false),

  ...manualDiscountFields,
});

export type CreateOrderLinkInput = z.infer<typeof createOrderLinkSchema>;

// Snapshots catalog products (name/image) for the given item specs; returns
// per-item create payloads for OrderLinkItem.
async function buildItemCreates(items: OrderLinkItemInput[]) {
  const catalogIds = [
    ...new Set(
      items.filter((i) => i.kind === "CATALOG" && i.productId).map((i) => i.productId as string),
    ),
  ];
  const catalogMap = new Map<string, { name: string; images: string[]; isActive: boolean }>();
  if (catalogIds.length) {
    const products = await prisma.product.findMany({
      where: { id: { in: catalogIds } },
      select: { id: true, name: true, images: true, isActive: true },
    });
    for (const p of products) {
      if (!p.isActive) throw HttpError.badRequest(`Product "${p.name}" is inactive`);
      catalogMap.set(p.id, p);
    }
    for (const id of catalogIds) {
      if (!catalogMap.has(id)) throw HttpError.badRequest("Product not found");
    }
  }

  return items.map((item, index) => {
    const catalog =
      item.kind === "CATALOG" && item.productId ? catalogMap.get(item.productId) : undefined;
    const productName =
      catalog && (!item.productName || item.productName === catalog.name)
        ? catalog.name
        : item.productName;
    const referenceImageUrl = item.referenceImageUrl ?? catalog?.images[0] ?? null;

    return {
      kind: item.kind,
      productId: item.productId ?? null,
      productName,
      sizeLabel: item.sizeLabel ?? null,
      sizeGrams: item.sizeGrams ?? null,
      flavourId: item.flavourId ?? null,
      flavourName: item.flavourName ?? null,
      referenceImageUrl,
      messageHint: item.messageHint ?? null,
      description: item.description || null,
      unitPrice: item.unitPrice,
      qty: item.qty,
      sortOrder: index,
    };
  });
}

export async function createOrderLink(input: CreateOrderLinkInput) {
  const itemCreates = await buildItemCreates(input.items);

  const expiresAt = input.expiresInDays
    ? new Date(Date.now() + input.expiresInDays * 24 * 3600 * 1000)
    : null;

  const suggestedDate = input.suggested?.date ? new Date(input.suggested.date) : null;

  const discount = parsedManualDiscount(input.discountType, input.discountValue);

  const created = await prisma.orderLink.create({
    data: {
      token: tokenGen(),
      customerName: input.customerName ?? null,
      customerPhone: input.customerPhone ?? null,
      suggestedDate,
      suggestedSlotKey: input.suggested?.key ?? null,
      suggestedSlotLabel: input.suggested?.label ?? null,
      adminNotes: input.adminNotes ?? null,
      expiresAt,
      discountType: discount.discountType,
      discountValue: discount.discountValue,
      deliveryFee: input.deliveryFee ?? null,
      allowOnlinePayment: input.allowOnlinePayment,
      items: { create: itemCreates },
    },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  return created;
}

export async function listOrderLinks(status?: string | null) {
  const validStatus = ["OPEN", "ORDERED", "EXPIRED", "CANCELLED"];
  return prisma.orderLink.findMany({
    where:
      status && validStatus.includes(status)
        ? { status: status as "OPEN" | "ORDERED" | "EXPIRED" | "CANCELLED" }
        : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      linkedOrder: {
        select: {
          id: true,
          orderNumber: true,
          total: true,
          customerName: true,
          status: true,
        },
      },
    },
  });
}

export async function getOrderLinkById(id: string) {
  const link = await prisma.orderLink.findUnique({
    where: { id },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      linkedOrder: {
        select: {
          id: true,
          orderNumber: true,
          total: true,
          customerName: true,
          status: true,
        },
      },
    },
  });
  if (!link) throw HttpError.notFound("Order link not found");
  return link;
}

// Public view — safe fields only, no adminNotes.
export async function getOrderLinkByToken(token: string) {
  const link = await prisma.orderLink.findUnique({
    where: { token },
    select: {
      id: true,
      token: true,
      customerName: true,
      customerPhone: true,
      suggestedDate: true,
      suggestedSlotKey: true,
      suggestedSlotLabel: true,
      status: true,
      expiresAt: true,
      discountType: true,
      discountValue: true,
      deliveryFee: true,
      allowOnlinePayment: true,
      items: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          kind: true,
          productId: true,
          productName: true,
          sizeLabel: true,
          sizeGrams: true,
          flavourId: true,
          flavourName: true,
          referenceImageUrl: true,
          messageHint: true,
          description: true,
          unitPrice: true,
          qty: true,
          product: { select: { gstRate: true, priceIsGstInclusive: true } },
        },
      },
      linkedOrder: { select: { orderNumber: true } },
    },
  });
  if (!link) throw HttpError.notFound("Order link not found");

  // Auto-mark expired links so the customer sees a clear message.
  if (link.status === "OPEN" && link.expiresAt && link.expiresAt.getTime() < Date.now()) {
    await prisma.orderLink.update({
      where: { id: link.id },
      data: { status: "EXPIRED" },
    });
    return { ...link, status: "EXPIRED" as const };
  }

  return link;
}

function resolveGiftBillingOrThrow(input: {
  fulfillment: "DELIVERY" | "PICKUP";
  customerName: string;
  customerPhone: string;
  deliveryAddress?: z.infer<typeof orderAddressSchema> | null;
  recipientName?: string | null;
  deliveryPhone?: string | null;
  billingAddress?: z.infer<typeof orderAddressSchema> | null;
  billingSameAsDelivery?: boolean;
  isSurpriseGift?: boolean;
}): ResolvedGiftBilling {
  try {
    return resolveGiftBilling(input);
  } catch (err) {
    if (err instanceof Error && err.message === "BILLING_ADDRESS_REQUIRED") {
      throw HttpError.badRequest("Billing address is required");
    }
    throw err;
  }
}

const addressSchema = orderAddressSchema;

export const placeOrderLinkSchema = z.object({
  customerName: z.string().trim().min(2),
  customerPhone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s]{7,15}$/, "Enter a valid phone"),
  customerEmail: z.string().email().trim().optional().nullable(),
  ...buyerGstFields,

  fulfillment: z.enum(["DELIVERY", "PICKUP"]),
  deliveryAddress: addressSchema.optional().nullable(),
  ...giftBillingFieldsSchema.shape,

  deliveryDate: z.string().min(1),
  deliverySlotKey: z.string().min(1),
  deliverySlotLabel: z.string().min(1),

  customerNotes: z.string().trim().max(500).optional().nullable(),

  // How much the customer pays now (online, via Cashfree). ADVANCE with 0 =
  // pay everything on delivery.
  paymentMode: z.enum(["FULL", "ADVANCE"]).default("FULL"),
  advanceAmount: z.coerce.number().nonnegative().optional().default(0),
});

export type PlaceOrderLinkInput = z.infer<typeof placeOrderLinkSchema>;

export async function placeOrderFromLink(token: string, input: PlaceOrderLinkInput) {
  const link = await prisma.orderLink.findUnique({
    where: { token },
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
        include: {
          product: {
            select: {
              gstRate: true,
              hsnCode: true,
              priceIsGstInclusive: true,
            },
          },
        },
      },
    },
  });
  if (!link) throw HttpError.notFound("Order link not found");
  if (link.status !== "OPEN") {
    throw HttpError.badRequest(
      link.status === "ORDERED"
        ? "This order link has already been used"
        : link.status === "EXPIRED"
          ? "This order link has expired"
          : "This order link was cancelled",
    );
  }
  if (link.expiresAt && link.expiresAt.getTime() < Date.now()) {
    await prisma.orderLink.update({
      where: { id: link.id },
      data: { status: "EXPIRED" },
    });
    throw HttpError.badRequest("This order link has expired");
  }
  if (link.items.length === 0) {
    throw HttpError.badRequest("This order link has no items");
  }

  // Reject past dates (mirrors createOrder guard).
  const dt = new Date(input.deliveryDate);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  if (Number.isNaN(dt.getTime()) || dt.getTime() < todayStart.getTime()) {
    throw HttpError.badRequest("Delivery date is in the past. Please pick a fresh date.");
  }
  await assertKitchenOpenOn(input.deliveryDate);

  if (input.fulfillment === "DELIVERY" && !input.deliveryAddress) {
    throw HttpError.badRequest("Delivery address is required for delivery orders");
  }

  const giftBilling = resolveGiftBillingOrThrow({
    fulfillment: input.fulfillment,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    deliveryAddress: input.deliveryAddress,
    recipientName: input.recipientName,
    deliveryPhone: input.deliveryPhone,
    billingAddress: input.billingAddress,
    billingSameAsDelivery: input.billingSameAsDelivery,
    isSurpriseGift: input.isSurpriseGift,
  });

  // Delivery fee: locked on the link when admin set one, else pincode table.
  let deliveryFee = 0;
  let isLocalZone = false;
  if (input.fulfillment === "DELIVERY" && input.deliveryAddress) {
    const info = await checkPincode(input.deliveryAddress.pincode);
    if (!info.serviceable) {
      throw HttpError.badRequest(
        "We don't currently deliver to this pincode. Choose pickup or a different address.",
      );
    }
    deliveryFee = link.deliveryFee != null ? Number(link.deliveryFee) : Number(info.deliveryFee);
    isLocalZone = true;
  }

  const sellerStateCode = await getSellerStateCode();
  const placeOfSupply = resolvePlaceOfSupply({
    fulfillment: input.fulfillment,
    deliveryAddress: input.deliveryAddress,
    sellerStateCode,
    localZoneStateCode: isLocalZone ? sellerStateCode : null,
    buyerGstin: input.customerGstin,
  });
  const isIntraState = placeOfSupply === sellerStateCode;

  // Tax per line (mirrors placeOfflineOrder) — each item may be its own
  // catalog product with its own GST rate. The manual discount is allocated
  // across lines first so every line is taxed on what was actually charged.
  const lineTotals = link.items.map((item) => Number(item.unitPrice) * item.qty);
  const subtotal = roundMoney(lineTotals.reduce((s, v) => s + v, 0));

  const discount = manualDiscountRupees(
    subtotal,
    link.discountType,
    link.discountValue != null ? Number(link.discountValue) : null,
  );
  const chargedLines = allocateCartDiscount(lineTotals, discount);

  const lineTaxes = link.items.map((item, idx) =>
    computeLineTax({
      lineInclusive: chargedLines[idx] ?? 0,
      gstRate: item.product?.gstRate != null ? Number(item.product.gstRate) : CUSTOM_GST_RATE,
      priceIsGstInclusive: item.product?.priceIsGstInclusive ?? CUSTOM_GST_INCLUSIVE,
      isIntraState,
    }),
  );
  const { taxableAmount, cgstAmount, sgstAmount, igstAmount } = sumLineTax(lineTaxes);

  const itemCreates = link.items.map((item, idx) => {
    const tax = lineTaxes[idx]!;
    return {
      productId: item.productId,
      productName: item.productName,
      productSlug: null,
      productImage: item.referenceImageUrl,
      sizeGrams: item.sizeGrams,
      sizeLabel: item.sizeLabel,
      flavourId: item.flavourId,
      flavourName: item.flavourName,
      messageOnCake: item.messageHint ?? null,
      instructions: null,
      description: item.description,
      referenceImageUrl: item.kind === "CUSTOM" ? item.referenceImageUrl : null,
      deliveryDate: dt,
      deliverySlotKey: input.deliverySlotKey,
      deliverySlotLabel: input.deliverySlotLabel,
      unitPrice: Number(item.unitPrice),
      qty: item.qty,
      lineTotal: lineTotals[idx] ?? 0,
      hsnCode: item.product?.hsnCode ?? CUSTOM_HSN_CODE,
      gstRate: item.product?.gstRate != null ? Number(item.product.gstRate) : CUSTOM_GST_RATE,
      taxableValue: tax.taxableValue,
      cgstAmount: tax.cgstAmount,
      sgstAmount: tax.sgstAmount,
      igstAmount: tax.igstAmount,
    };
  });

  const gstOnTop = gstAddedOnTop(
    lineTaxes,
    link.items.map((item) => item.product?.priceIsGstInclusive ?? CUSTOM_GST_INCLUSIVE),
  );
  const total = roundMoney(subtotal - discount + deliveryFee + gstOnTop);

  // Anything paid upfront goes through Cashfree; the order is recorded as
  // unpaid and flips once the gateway confirms. Pay-on-delivery stays COD.
  const payingNow = roundMoney(
    Math.min(input.paymentMode === "FULL" ? total : (input.advanceAmount ?? 0), total),
  );
  const payOnline = payingNow > 0;
  if (payOnline && !link.allowOnlinePayment) {
    throw HttpError.badRequest("This order is paid on delivery or pickup.");
  }
  if (payOnline && !cashfreeEnabled()) {
    throw HttpError.badRequest(
      "Online payment isn't available right now. Please choose pay on delivery or contact us.",
    );
  }
  if (payOnline && payingNow < 1) {
    throw HttpError.badRequest("Upfront amount must be at least ₹1");
  }
  const { advanceAmount, paymentStatus, paymentMethod } = payOnline
    ? ({ advanceAmount: 0, paymentStatus: "PENDING", paymentMethod: "cashfree" } as const)
    : resolvePayment(input.paymentMode, input.advanceAmount, total, false);

  const orderNumber = buildOrderNumber();

  const order = await prisma.$transaction(async (tx) => {
    const userId = await ensureCustomerForOrder(tx, {
      name: input.customerName,
      phone: input.customerPhone,
      email: input.customerEmail,
    });

    const created = await tx.order.create({
      data: {
        userId,
        orderNumber,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        customerEmail: input.customerEmail ?? null,
        customerCompanyName: input.customerCompanyName ?? null,
        customerGstin: input.customerGstin ?? null,
        recipientName: giftBilling.recipientName,
        deliveryPhone: giftBilling.deliveryPhone,
        fulfillment: input.fulfillment,
        deliveryAddress:
          input.fulfillment === "DELIVERY" && input.deliveryAddress
            ? input.deliveryAddress
            : undefined,
        billingAddress: giftBilling.billingAddress ?? undefined,
        isSurpriseGift: giftBilling.isSurpriseGift,
        subtotal,
        deliveryFee,
        discount,
        total,
        taxableAmount,
        cgstAmount,
        sgstAmount,
        igstAmount,
        placeOfSupply,
        paymentMethod,
        paymentStatus,
        paymentMode: input.paymentMode,
        advanceAmount,
        source: "OFFLINE_LINK",
        customerNotes: input.customerNotes ?? null,
        items: { create: itemCreates },
      },
      include: { items: true },
    });
    await tx.orderLink.update({
      where: { id: link.id },
      data: { status: "ORDERED", linkedOrderId: created.id },
    });
    return created;
  });

  if (!payOnline) {
    notifyOrderPlaced(order);
    return { ...order, payment: null };
  }

  // Open the gateway session now so the chosen upfront amount is pinned
  // server-side. If Cashfree hiccups the order still exists and the customer
  // can retry from the order page.
  try {
    const payment = await createPaymentSession(order.orderNumber, { amount: payingNow });
    return { ...order, payment };
  } catch (err) {
    logger.error({ err, orderId: order.id }, "order-link payment session failed");
    return { ...order, payment: null };
  }
}

export const updateOrderLinkSchema = z.object({
  status: z.enum(["CANCELLED"]).optional(),
  expiresInDays: z.coerce.number().int().positive().max(365).nullable().optional(),
  adminNotes: z.string().trim().max(2000).nullable().optional(),

  // Spec edits — only honoured while status is OPEN.
  items: z
    .array(orderLinkItemSchema)
    .min(1, "Add at least one item")
    .refine(itemsRefine, {
      message: "productId required for CATALOG items",
      path: ["items"],
    })
    .optional(),
  customerName: z.string().trim().nullable().optional(),
  customerPhone: z.string().trim().nullable().optional(),
  deliveryFee: z.coerce.number().nonnegative().nullable().optional(),
  allowOnlinePayment: z.boolean().optional(),
  ...manualDiscountFields,
});

export type UpdateOrderLinkInput = z.infer<typeof updateOrderLinkSchema>;

export async function updateOrderLink(id: string, input: UpdateOrderLinkInput) {
  const existing = await prisma.orderLink.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!existing) throw HttpError.notFound("Order link not found");

  const editingSpec = input.items !== undefined;
  if (editingSpec && existing.status !== "OPEN") {
    throw HttpError.badRequest("Cannot edit a link that has already been used or cancelled");
  }

  const data: Record<string, unknown> = {};
  if (input.status) data.status = input.status;
  if (input.adminNotes !== undefined) data.adminNotes = input.adminNotes;
  if (input.customerName !== undefined) data.customerName = input.customerName;
  if (input.customerPhone !== undefined) data.customerPhone = input.customerPhone;
  if (input.deliveryFee !== undefined) data.deliveryFee = input.deliveryFee;
  if (input.allowOnlinePayment !== undefined) data.allowOnlinePayment = input.allowOnlinePayment;
  if (input.expiresInDays !== undefined) {
    data.expiresAt = input.expiresInDays
      ? new Date(Date.now() + input.expiresInDays * 24 * 3600 * 1000)
      : null;
  }
  if (input.discountType !== undefined || input.discountValue !== undefined) {
    const discount = parsedManualDiscount(input.discountType, input.discountValue);
    data.discountType = discount.discountType;
    data.discountValue = discount.discountValue;
  }

  if (input.items) {
    const itemCreates = await buildItemCreates(input.items);
    data.items = {
      deleteMany: {},
      create: itemCreates,
    };
  }

  return prisma.orderLink.update({
    where: { id },
    data,
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      linkedOrder: {
        select: {
          id: true,
          orderNumber: true,
          total: true,
          customerName: true,
          status: true,
        },
      },
    },
  });
}

/** Removes a link that never became an order; its items go with it. */
export async function deleteOrderLink(id: string) {
  const existing = await prisma.orderLink.findUnique({
    where: { id },
    select: { id: true, linkedOrder: { select: { orderNumber: true } } },
  });
  if (!existing) throw HttpError.notFound("Order link not found");
  if (existing.linkedOrder) {
    throw HttpError.conflict(
      `This link became order ${existing.linkedOrder.orderNumber}, so it can't be deleted.`,
    );
  }
  await prisma.orderLink.delete({ where: { id } });
  return { id };
}

// -------- Offline order (admin fills EVERYTHING, no customer link) --------

const offlineItemSchema = z.object({
  kind: z.enum(["CUSTOM", "CATALOG"]),
  productId: z.string().min(1).optional().nullable(),
  productName: z.string().trim().min(2),
  sizeLabel: z.string().trim().nullable().optional(),
  sizeGrams: z.coerce.number().int().positive().nullable().optional(),
  flavourId: z.string().nullable().optional(),
  flavourName: z.string().trim().nullable().optional(),
  referenceImageUrl: z.string().url().nullable().optional(),
  messageOnCake: z.string().trim().max(200).optional().nullable(),
  instructions: z.string().trim().max(500).optional().nullable(),
  description: z.string().trim().max(1000).optional().nullable(),
  unitPrice: z.coerce.number().nonnegative(),
  qty: z.coerce.number().int().positive().default(1),
});

export const placeOfflineOrderSchema = z.object({
  items: z
    .array(offlineItemSchema)
    .min(1, "Add at least one item")
    .refine((items) => items.every((i) => (i.kind === "CATALOG" ? !!i.productId : true)), {
      message: "productId required for CATALOG items",
      path: ["items"],
    }),

  customerName: z.string().trim().min(2),
  customerPhone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s]{7,15}$/, "Enter a valid phone"),
  customerEmail: z.string().email().trim().optional().nullable(),
  ...buyerGstFields,

  fulfillment: z.enum(["DELIVERY", "PICKUP"]),
  deliveryAddress: addressSchema.optional().nullable(),
  ...giftBillingFieldsSchema.shape,
  deliveryDate: z.string().min(1),
  deliverySlotKey: z.string().min(1),
  deliverySlotLabel: z.string().min(1),

  customerNotes: z.string().trim().max(500).optional().nullable(),
  adminNotes: z.string().trim().max(2000).nullable().optional(),

  // How much is being collected right now, and proof of it. Pay on delivery is
  // ADVANCE with advanceAmount 0.
  paymentMode: z.enum(["FULL", "ADVANCE"]).default("FULL"),
  advanceAmount: z.coerce.number().nonnegative().optional().default(0),
  paymentMethod: z.enum(OFFLINE_PAYMENT_METHODS).optional(),
  paymentScreenshotUrls: z.array(z.string().url()).max(MAX_PAYMENT_SCREENSHOTS).default([]),

  // Optional override of the pincode-table delivery fee (admin offline only).
  deliveryFee: z.coerce.number().nonnegative().optional().nullable(),

  ...manualDiscountFields,
});

export type PlaceOfflineOrderInput = z.infer<typeof placeOfflineOrderSchema>;

export async function placeOfflineOrder(input: PlaceOfflineOrderInput) {
  const dt = new Date(input.deliveryDate);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  if (Number.isNaN(dt.getTime()) || dt.getTime() < todayStart.getTime()) {
    throw HttpError.badRequest("Delivery date is in the past. Please pick a fresh date.");
  }
  await assertKitchenOpenOn(input.deliveryDate);

  if (input.fulfillment === "DELIVERY" && !input.deliveryAddress) {
    throw HttpError.badRequest("Delivery address is required for delivery orders");
  }

  const giftBilling = resolveGiftBillingOrThrow({
    fulfillment: input.fulfillment,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    deliveryAddress: input.deliveryAddress,
    recipientName: input.recipientName,
    deliveryPhone: input.deliveryPhone,
    billingAddress: input.billingAddress,
    billingSameAsDelivery: input.billingSameAsDelivery,
    isSurpriseGift: input.isSurpriseGift,
  });

  let deliveryFee = 0;
  let isLocalZone = false;
  if (input.fulfillment === "DELIVERY" && input.deliveryAddress) {
    const info = await checkPincode(input.deliveryAddress.pincode);
    if (!info.serviceable) {
      throw HttpError.badRequest(
        "We don't currently deliver to this pincode. Choose pickup or a different address.",
      );
    }
    deliveryFee = input.deliveryFee != null ? Number(input.deliveryFee) : Number(info.deliveryFee);
    isLocalZone = true;
  }

  // Snapshot every catalog product upfront so all validation fails fast.
  const catalogIds = [
    ...new Set(
      input.items
        .filter((i) => i.kind === "CATALOG" && i.productId)
        .map((i) => i.productId as string),
    ),
  ];
  const catalogMap = new Map<
    string,
    {
      name: string;
      slug: string;
      images: string[];
      gstRate: number;
      hsnCode: string;
      priceIsGstInclusive: boolean;
    }
  >();
  if (catalogIds.length) {
    const products = await prisma.product.findMany({
      where: { id: { in: catalogIds } },
      select: {
        id: true,
        name: true,
        slug: true,
        images: true,
        isActive: true,
        gstRate: true,
        hsnCode: true,
        priceIsGstInclusive: true,
      },
    });
    for (const p of products) {
      if (!p.isActive) throw HttpError.badRequest(`Product "${p.name}" is inactive`);
      catalogMap.set(p.id, {
        name: p.name,
        slug: p.slug,
        images: p.images,
        gstRate: Number(p.gstRate),
        hsnCode: p.hsnCode,
        priceIsGstInclusive: p.priceIsGstInclusive,
      });
    }
    for (const id of catalogIds) {
      if (!catalogMap.has(id)) throw HttpError.badRequest("Product not found");
    }
  }

  const sellerStateCode = await getSellerStateCode();
  const placeOfSupply = resolvePlaceOfSupply({
    fulfillment: input.fulfillment,
    deliveryAddress: input.deliveryAddress,
    sellerStateCode,
    // Offline addresses are typed against DeliveryPincode, which has no state
    // column, so a serviceable pincode is what establishes the state here.
    localZoneStateCode: isLocalZone ? sellerStateCode : null,
    buyerGstin: input.customerGstin,
  });
  const isIntraState = placeOfSupply === sellerStateCode;

  // Per-item computation — GST rate depends on the item's own kind/product.
  const resolvedItems = input.items.map((item) => {
    const catalog =
      item.kind === "CATALOG" && item.productId ? catalogMap.get(item.productId) : undefined;
    return {
      item,
      catalog,
      gstRate: catalog ? catalog.gstRate : CUSTOM_GST_RATE,
      hsnCode: catalog ? catalog.hsnCode : CUSTOM_HSN_CODE,
      inclusive: catalog ? catalog.priceIsGstInclusive : CUSTOM_GST_INCLUSIVE,
      lineTotal: Number(item.unitPrice) * item.qty,
    };
  });

  const subtotal = roundMoney(resolvedItems.reduce((s, r) => s + r.lineTotal, 0));

  const spec = parsedManualDiscount(input.discountType, input.discountValue);
  const discount = manualDiscountRupees(subtotal, spec.discountType, spec.discountValue);
  const chargedLines = allocateCartDiscount(
    resolvedItems.map((r) => r.lineTotal),
    discount,
  );

  const lineTaxes = resolvedItems.map((r, idx) =>
    computeLineTax({
      lineInclusive: chargedLines[idx] ?? 0,
      gstRate: r.gstRate,
      priceIsGstInclusive: r.inclusive,
      isIntraState,
    }),
  );
  const { taxableAmount, cgstAmount, sgstAmount, igstAmount } = sumLineTax(lineTaxes);

  const itemCreates = resolvedItems.map((r, idx) => {
    const { item, catalog } = r;
    const tax = lineTaxes[idx]!;

    const productName =
      catalog && (!item.productName || item.productName === catalog.name)
        ? catalog.name
        : item.productName;

    return {
      productId: item.productId ?? null,
      productName,
      productSlug: catalog?.slug ?? null,
      productImage: item.referenceImageUrl ?? catalog?.images[0] ?? null,
      sizeGrams: item.sizeGrams ?? null,
      sizeLabel: item.sizeLabel ?? null,
      flavourId: item.flavourId ?? null,
      flavourName: item.flavourName ?? null,
      messageOnCake: item.messageOnCake ?? null,
      instructions: item.instructions ?? null,
      description: item.description || null,
      referenceImageUrl: item.kind === "CUSTOM" ? (item.referenceImageUrl ?? null) : null,
      deliveryDate: dt,
      deliverySlotKey: input.deliverySlotKey,
      deliverySlotLabel: input.deliverySlotLabel,
      unitPrice: Number(item.unitPrice),
      qty: item.qty,
      lineTotal: r.lineTotal,
      hsnCode: r.hsnCode,
      gstRate: r.gstRate,
      taxableValue: tax.taxableValue,
      cgstAmount: tax.cgstAmount,
      sgstAmount: tax.sgstAmount,
      igstAmount: tax.igstAmount,
    };
  });

  const gstOnTop = gstAddedOnTop(
    lineTaxes,
    resolvedItems.map((r) => r.inclusive),
  );
  const total = roundMoney(subtotal - discount + deliveryFee + gstOnTop);
  const orderNumber = buildOrderNumber();

  const { advanceAmount, paymentStatus, paymentMethod } = resolvePayment(
    input.paymentMode,
    input.advanceAmount,
    total,
    input.paymentScreenshotUrls.length > 0,
    input.paymentMethod,
  );

  const userId = await ensureCustomerForOrder(prisma, {
    name: input.customerName,
    phone: input.customerPhone,
    email: input.customerEmail,
    allowRegisteredLink: true,
  });

  const order = await prisma.order.create({
    data: {
      userId,
      orderNumber,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail ?? null,
      customerCompanyName: input.customerCompanyName ?? null,
      customerGstin: input.customerGstin ?? null,
      recipientName: giftBilling.recipientName,
      deliveryPhone: giftBilling.deliveryPhone,
      fulfillment: input.fulfillment,
      deliveryAddress:
        input.fulfillment === "DELIVERY" && input.deliveryAddress
          ? input.deliveryAddress
          : undefined,
      billingAddress: giftBilling.billingAddress ?? undefined,
      isSurpriseGift: giftBilling.isSurpriseGift,
      subtotal,
      deliveryFee,
      discount,
      total,
      taxableAmount,
      cgstAmount,
      sgstAmount,
      igstAmount,
      placeOfSupply,
      paymentMethod,
      paymentStatus,
      paymentMode: input.paymentMode,
      advanceAmount,
      paymentScreenshotUrls: input.paymentScreenshotUrls,
      source: "OFFLINE_DIRECT",
      customerNotes: input.customerNotes ?? null,
      adminNotes: input.adminNotes ?? null,
      items: { create: itemCreates },
    },
    include: { items: true },
  });

  notifyOrderPlaced(order);

  return order;
}
