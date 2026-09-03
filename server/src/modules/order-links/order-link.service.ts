import { customAlphabet } from "nanoid";
import { z } from "zod";
import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";
import { checkPincode } from "../delivery/delivery.service.js";
import { sendEmail } from "../email/email.service.js";
import {
  renderAdminNotification,
  renderCustomerConfirmation,
} from "../email/templates.js";
import { logger } from "../../utils/logger.js";
import { emitNewOrder } from "../../lib/events.js";
import { buildOrderNumber } from "../orders/order.service.js";
import { assertKitchenOpenOn } from "../store/store.service.js";
import {
  manualDiscountRupees,
  scaleGstForCartDiscount,
  type ManualDiscountType,
} from "../coupons/coupon.service.js";
import { ensureCustomerForOrder } from "../customers/customer.service.js";

// 31-char lower-safe alphabet (drops i, l, o, 1, 0 to avoid ambiguity).
const tokenGen = customAlphabet("abcdefghjkmnpqrstuvwxyz23456789", 8);

// GST assumption for custom-cake links (no product to inherit from).
// Standard bakery HSN 1905 → 5% inclusive. Admin can override later.
const CUSTOM_GST_RATE = 5;
const CUSTOM_GST_INCLUSIVE = true;

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
    paymentMode === "FULL"
      ? total
      : Math.min(Math.max(rawAdvanceAmount ?? 0, 0), total);
  const paymentStatus =
    advanceAmount <= 0
      ? "PENDING"
      : advanceAmount >= total
        ? "PAID"
        : "PARTIAL";
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

  expiresInDays: z.coerce
    .number()
    .int()
    .positive()
    .max(365)
    .nullable()
    .optional(),

  ...manualDiscountFields,
});

export type CreateOrderLinkInput = z.infer<typeof createOrderLinkSchema>;

// Snapshots catalog products (name/image) for the given item specs; returns
// per-item create payloads for OrderLinkItem.
async function buildItemCreates(items: OrderLinkItemInput[]) {
  const catalogIds = [
    ...new Set(
      items
        .filter((i) => i.kind === "CATALOG" && i.productId)
        .map((i) => i.productId as string),
    ),
  ];
  const catalogMap = new Map<
    string,
    { name: string; images: string[]; isActive: boolean }
  >();
  if (catalogIds.length) {
    const products = await prisma.product.findMany({
      where: { id: { in: catalogIds } },
      select: { id: true, name: true, images: true, isActive: true },
    });
    for (const p of products) {
      if (!p.isActive)
        throw HttpError.badRequest(`Product "${p.name}" is inactive`);
      catalogMap.set(p.id, p);
    }
    for (const id of catalogIds) {
      if (!catalogMap.has(id)) throw HttpError.badRequest("Product not found");
    }
  }

  return items.map((item, index) => {
    const catalog =
      item.kind === "CATALOG" && item.productId
        ? catalogMap.get(item.productId)
        : undefined;
    const productName =
      catalog && (!item.productName || item.productName === catalog.name)
        ? catalog.name
        : item.productName;
    const referenceImageUrl =
      item.referenceImageUrl ?? catalog?.images[0] ?? null;

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

  const suggestedDate = input.suggested?.date
    ? new Date(input.suggested.date)
    : null;

  const discount = parsedManualDiscount(
    input.discountType,
    input.discountValue,
  );

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
  if (
    link.status === "OPEN" &&
    link.expiresAt &&
    link.expiresAt.getTime() < Date.now()
  ) {
    await prisma.orderLink.update({
      where: { id: link.id },
      data: { status: "EXPIRED" },
    });
    return { ...link, status: "EXPIRED" as const };
  }

  return link;
}

const addressSchema = z.object({
  line1: z.string().trim().min(3),
  line2: z.string().trim().optional().nullable(),
  landmark: z.string().trim().optional().nullable(),
  mapSearchQuery: z.string().trim().min(3).max(200),
  pincode: z.string().regex(/^\d{6}$/),
  city: z.string().trim().optional().nullable(),
  area: z.string().trim().optional().nullable(),
  state: z.string().trim().optional().nullable(),
  stateCode: z.string().trim().optional().nullable(),
});

export const placeOrderLinkSchema = z.object({
  customerName: z.string().trim().min(2),
  customerPhone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s]{7,15}$/, "Enter a valid phone"),
  customerEmail: z.string().email().trim().optional().nullable(),

  fulfillment: z.enum(["DELIVERY", "PICKUP"]),
  deliveryAddress: addressSchema.optional().nullable(),

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

export async function placeOrderFromLink(
  token: string,
  input: PlaceOrderLinkInput,
) {
  const link = await prisma.orderLink.findUnique({
    where: { token },
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
        include: {
          product: {
            select: { gstRate: true, priceIsGstInclusive: true },
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
    throw HttpError.badRequest(
      "Delivery date is in the past. Please pick a fresh date.",
    );
  }
  await assertKitchenOpenOn(input.deliveryDate);

  if (input.fulfillment === "DELIVERY" && !input.deliveryAddress) {
    throw HttpError.badRequest(
      "Delivery address is required for delivery orders",
    );
  }

  // Delivery fee lookup
  let deliveryFee = 0;
  if (input.fulfillment === "DELIVERY" && input.deliveryAddress) {
    const info = await checkPincode(input.deliveryAddress.pincode);
    if (!info.serviceable) {
      throw HttpError.badRequest(
        "We don't currently deliver to this pincode. Choose pickup or a different address.",
      );
    }
    deliveryFee = Number(info.deliveryFee);
  }

  const BUSINESS_STATE_CODE = "19";
  const isIntraState =
    input.fulfillment === "PICKUP" ||
    input.deliveryAddress?.stateCode === BUSINESS_STATE_CODE;

  // Per-item GST computation (mirrors placeOfflineOrder) — each item may be
  // its own catalog product with its own GST rate.
  let subtotal = 0;
  let taxableAmount = 0;
  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;
  const itemCreates = link.items.map((item) => {
    const gstRate =
      item.product?.gstRate != null
        ? Number(item.product.gstRate)
        : CUSTOM_GST_RATE;
    const inclusive =
      item.product?.priceIsGstInclusive != null
        ? item.product.priceIsGstInclusive
        : CUSTOM_GST_INCLUSIVE;

    const unitPrice = Number(item.unitPrice);
    const lineIncl = unitPrice * item.qty;
    const lineTaxable = inclusive ? lineIncl / (1 + gstRate / 100) : lineIncl;
    const lineGst = inclusive
      ? lineIncl - lineTaxable
      : lineIncl * (gstRate / 100);

    subtotal += lineIncl;
    taxableAmount += lineTaxable;
    if (isIntraState) {
      cgstAmount += lineGst / 2;
      sgstAmount += lineGst / 2;
    } else {
      igstAmount += lineGst;
    }

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
      unitPrice,
      qty: item.qty,
      lineTotal: lineIncl,
    };
  });

  const discount = manualDiscountRupees(
    subtotal,
    link.discountType,
    link.discountValue != null ? Number(link.discountValue) : null,
  );
  const gst = scaleGstForCartDiscount(
    taxableAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    subtotal,
    discount,
  );
  taxableAmount = gst.taxableAmount;
  cgstAmount = gst.cgstAmount;
  sgstAmount = gst.sgstAmount;
  igstAmount = gst.igstAmount;

  const total = subtotal - discount + deliveryFee;

  const payingNow =
    input.paymentMode === "FULL" ? total : (input.advanceAmount ?? 0);
  if (payingNow > 0 && !input.paymentScreenshotUrl) {
    throw HttpError.badRequest(
      "Please upload a screenshot of your payment to confirm the order",
    );
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
        fulfillment: input.fulfillment,
        deliveryAddress:
          input.fulfillment === "DELIVERY" && input.deliveryAddress
            ? input.deliveryAddress
            : undefined,
        subtotal,
        deliveryFee,
        discount,
        total,
        taxableAmount,
        cgstAmount,
        sgstAmount,
        igstAmount,
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
    logger.error(
      { err, orderId: order.id },
      "order-link email dispatch failed",
    );
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

async function sendOrderLinkEmails(
  order: Awaited<ReturnType<typeof placeOrderFromLink>>,
) {
  const settings = await prisma.businessSettings.findFirst({
    select: { supportEmail: true, orderNotificationEmail: true },
  });
  const adminRecipient =
    settings?.orderNotificationEmail || settings?.supportEmail;

  if (order.customerEmail) {
    const { subject, html } = renderCustomerConfirmation(order);
    void sendEmail({
      to: order.customerEmail,
      subject,
      html,
      replyTo: adminRecipient ?? undefined,
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
  expiresInDays: z.coerce
    .number()
    .int()
    .positive()
    .max(365)
    .nullable()
    .optional(),
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
    throw HttpError.badRequest(
      "Cannot edit a link that has already been used or cancelled",
    );
  }

  const data: Record<string, unknown> = {};
  if (input.status) data.status = input.status;
  if (input.adminNotes !== undefined) data.adminNotes = input.adminNotes;
  if (input.customerName !== undefined) data.customerName = input.customerName;
  if (input.customerPhone !== undefined)
    data.customerPhone = input.customerPhone;
  if (input.expiresInDays !== undefined) {
    data.expiresAt = input.expiresInDays
      ? new Date(Date.now() + input.expiresInDays * 24 * 3600 * 1000)
      : null;
  }
  if (input.discountType !== undefined || input.discountValue !== undefined) {
    const discount = parsedManualDiscount(
      input.discountType,
      input.discountValue,
    );
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
    .refine(
      (items) =>
        items.every((i) => (i.kind === "CATALOG" ? !!i.productId : true)),
      { message: "productId required for CATALOG items", path: ["items"] },
    ),

  customerName: z.string().trim().min(2),
  customerPhone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s]{7,15}$/, "Enter a valid phone"),
  customerEmail: z.string().email().trim().optional().nullable(),

  fulfillment: z.enum(["DELIVERY", "PICKUP"]),
  deliveryAddress: addressSchema.optional().nullable(),
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
    throw HttpError.badRequest(
      "Delivery date is in the past. Please pick a fresh date.",
    );
  }
  await assertKitchenOpenOn(input.deliveryDate);

  if (input.fulfillment === "DELIVERY" && !input.deliveryAddress) {
    throw HttpError.badRequest(
      "Delivery address is required for delivery orders",
    );
  }

  let deliveryFee = 0;
  if (input.fulfillment === "DELIVERY" && input.deliveryAddress) {
    const info = await checkPincode(input.deliveryAddress.pincode);
    if (!info.serviceable) {
      throw HttpError.badRequest(
        "We don't currently deliver to this pincode. Choose pickup or a different address.",
      );
    }
    deliveryFee = Number(info.deliveryFee);
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
        priceIsGstInclusive: true,
      },
    });
    for (const p of products) {
      if (!p.isActive)
        throw HttpError.badRequest(`Product "${p.name}" is inactive`);
      catalogMap.set(p.id, {
        name: p.name,
        slug: p.slug,
        images: p.images,
        gstRate: Number(p.gstRate),
        priceIsGstInclusive: p.priceIsGstInclusive,
      });
    }
    for (const id of catalogIds) {
      if (!catalogMap.has(id)) throw HttpError.badRequest("Product not found");
    }
  }

  const BUSINESS_STATE_CODE = "19";
  const isIntraState =
    input.fulfillment === "PICKUP" ||
    input.deliveryAddress?.stateCode === BUSINESS_STATE_CODE;

  // Per-item computation — GST rate depends on the item's own kind/product.
  let subtotal = 0;
  let taxableAmount = 0;
  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;
  const itemCreates = input.items.map((item) => {
    const catalog =
      item.kind === "CATALOG" && item.productId
        ? catalogMap.get(item.productId)
        : undefined;

    const productName =
      catalog && (!item.productName || item.productName === catalog.name)
        ? catalog.name
        : item.productName;
    const productSlug = catalog?.slug ?? null;
    const catalogImage = catalog?.images[0] ?? null;
    const productImage = item.referenceImageUrl ?? catalogImage;
    const gstRate = catalog ? catalog.gstRate : CUSTOM_GST_RATE;
    const inclusive = catalog
      ? catalog.priceIsGstInclusive
      : CUSTOM_GST_INCLUSIVE;

    const unitPrice = Number(item.unitPrice);
    const qty = item.qty;
    const lineIncl = unitPrice * qty;
    const lineTaxable = inclusive ? lineIncl / (1 + gstRate / 100) : lineIncl;
    const lineGst = inclusive
      ? lineIncl - lineTaxable
      : lineIncl * (gstRate / 100);

    subtotal += lineIncl;
    taxableAmount += lineTaxable;
    if (isIntraState) {
      cgstAmount += lineGst / 2;
      sgstAmount += lineGst / 2;
    } else {
      igstAmount += lineGst;
    }

    return {
      productId: item.productId ?? null,
      productName,
      productSlug,
      productImage,
      sizeGrams: item.sizeGrams ?? null,
      sizeLabel: item.sizeLabel ?? null,
      flavourId: item.flavourId ?? null,
      flavourName: item.flavourName ?? null,
      messageOnCake: item.messageOnCake ?? null,
      instructions: item.instructions ?? null,
      referenceImageUrl:
        item.kind === "CUSTOM" ? (item.referenceImageUrl ?? null) : null,
      deliveryDate: dt,
      deliverySlotKey: input.deliverySlotKey,
      deliverySlotLabel: input.deliverySlotLabel,
      unitPrice,
      qty,
      lineTotal: lineIncl,
    };
  });

  const spec = parsedManualDiscount(input.discountType, input.discountValue);
  const discount = manualDiscountRupees(
    subtotal,
    spec.discountType,
    spec.discountValue,
  );
  const gst = scaleGstForCartDiscount(
    taxableAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    subtotal,
    discount,
  );
  taxableAmount = gst.taxableAmount;
  cgstAmount = gst.cgstAmount;
  sgstAmount = gst.sgstAmount;
  igstAmount = gst.igstAmount;

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
      fulfillment: input.fulfillment,
      deliveryAddress:
        input.fulfillment === "DELIVERY" && input.deliveryAddress
          ? input.deliveryAddress
          : undefined,
      subtotal,
      deliveryFee,
      discount,
      total,
      taxableAmount,
      cgstAmount,
      sgstAmount,
      igstAmount,
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
    logger.error(
      { err, orderId: order.id },
      "offline order email dispatch failed",
    );
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
