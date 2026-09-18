import { customAlphabet } from "nanoid";
import { z } from "zod";
import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";
import { checkPincode } from "../delivery/delivery.service.js";
import { sendEmail } from "../email/email.service.js";
import { renderAdminNotification, renderCustomerConfirmation } from "../email/templates.js";
import { logger } from "../../utils/logger.js";
import { emitNewOrder } from "../../lib/events.js";
import { buildOrderNumber } from "../orders/order.service.js";
import { invoiceAttachmentIfPaid } from "../orders/invoice.service.js";
import { assertKitchenOpenOn } from "../store/store.service.js";
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
  resolvePlaceOfSupply,
  sumLineTax,
} from "../orders/order.tax.js";
import { buyerGstFields } from "../../lib/gstin.js";
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

// Shared by the order-link and offline-direct flows — turns a chosen
// payment mode + raw advance amount into the amount/status/method to persist.
// `paymentMethod` stays "cod" until Razorpay lands; a screenshot implies a
// manual UPI/bank transfer was already verified.
function resolvePayment(
  paymentMode: "FULL" | "ADVANCE",
  rawAdvanceAmount: number | undefined,
  total: number,
  paymentScreenshotUrl: string | null | undefined,
) {
  const advanceAmount =
    paymentMode === "FULL" ? total : Math.min(Math.max(rawAdvanceAmount ?? 0, 0), total);
  const paymentStatus =
    advanceAmount <= 0 ? "PENDING" : advanceAmount >= total ? "PAID" : "PARTIAL";
  const paymentMethod = paymentScreenshotUrl ? "upi" : "cod";
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
          unitPrice: true,
          qty: true,
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

  // How much the customer is paying now, and proof of the transfer.
  paymentMode: z.enum(["FULL", "ADVANCE"]).default("FULL"),
  advanceAmount: z.coerce.number().nonnegative().optional().default(0),
  paymentScreenshotUrl: z.string().url().nullable().optional(),
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

  // Delivery fee lookup
  let deliveryFee = 0;
  let isLocalZone = false;
  if (input.fulfillment === "DELIVERY" && input.deliveryAddress) {
    const info = await checkPincode(input.deliveryAddress.pincode);
    if (!info.serviceable) {
      throw HttpError.badRequest(
        "We don't currently deliver to this pincode. Choose pickup or a different address.",
      );
    }
    deliveryFee = Number(info.deliveryFee);
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

  const total = subtotal - discount + deliveryFee;

  const payingNow = input.paymentMode === "FULL" ? total : (input.advanceAmount ?? 0);
  if (payingNow > 0 && !input.paymentScreenshotUrl) {
    throw HttpError.badRequest("Please upload a screenshot of your payment to confirm the order");
  }
  const { advanceAmount, paymentStatus, paymentMethod } = resolvePayment(
    input.paymentMode,
    input.advanceAmount,
    total,
    input.paymentScreenshotUrl,
  );

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
        paymentScreenshotUrl: input.paymentScreenshotUrl ?? null,
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

  // Fire-and-forget notifications (same as regular checkout).
  void sendOrderLinkEmails(order).catch((err) => {
    logger.error({ err, orderId: order.id }, "order-link email dispatch failed");
  });

  emitNewOrder({
    id: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    total: order.total.toString(),
    source: "OFFLINE_LINK",
    itemCount: order.items.length,
    createdAt: order.createdAt.toISOString(),
  });

  return order;
}

async function sendOrderLinkEmails(order: Awaited<ReturnType<typeof placeOrderFromLink>>) {
  const settings = await prisma.businessSettings.findFirst({
    select: { supportEmail: true, orderNotificationEmail: true },
  });
  const adminRecipient = settings?.orderNotificationEmail || settings?.supportEmail;

  if (order.customerEmail) {
    const { subject, html } = renderCustomerConfirmation(order);
    // Offline and link orders are often collected in full upfront, so the
    // invoice rides along with the confirmation the same way it does on the
    // storefront.
    const invoice = await invoiceAttachmentIfPaid(order);
    void sendEmail({
      to: order.customerEmail,
      subject,
      html,
      replyTo: adminRecipient ?? undefined,
      ...(invoice ? { attachments: [invoice] } : {}),
    });
  }
  if (adminRecipient) {
    const { subject, html } = renderAdminNotification(order);
    void sendEmail({
      to: adminRecipient,
      subject,
      html,
      replyTo: order.customerEmail ?? undefined,
    });
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

  // How much is being collected right now, and proof of it.
  paymentMode: z.enum(["FULL", "ADVANCE"]).default("FULL"),
  advanceAmount: z.coerce.number().nonnegative().optional().default(0),
  paymentScreenshotUrl: z.string().url().nullable().optional(),

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
    deliveryFee = Number(info.deliveryFee);
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

  const total = subtotal - discount + deliveryFee;
  const orderNumber = buildOrderNumber();

  const { advanceAmount, paymentStatus, paymentMethod } = resolvePayment(
    input.paymentMode,
    input.advanceAmount,
    total,
    input.paymentScreenshotUrl,
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
      paymentScreenshotUrl: input.paymentScreenshotUrl ?? null,
      source: "OFFLINE_DIRECT",
      customerNotes: input.customerNotes ?? null,
      adminNotes: input.adminNotes ?? null,
      items: { create: itemCreates },
    },
    include: { items: true },
  });

  void sendOrderLinkEmails(order).catch((err) => {
    logger.error({ err, orderId: order.id }, "offline order email dispatch failed");
  });

  emitNewOrder({
    id: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    total: order.total.toString(),
    source: "OFFLINE_DIRECT",
    itemCount: order.items.length,
    createdAt: order.createdAt.toISOString(),
  });

  return order;
}
