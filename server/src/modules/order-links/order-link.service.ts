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
import { buildOrderNumber } from "../orders/order.service.js";

// 31-char lower-safe alphabet (drops i, l, o, 1, 0 to avoid ambiguity).
const tokenGen = customAlphabet("abcdefghjkmnpqrstuvwxyz23456789", 8);

// GST assumption for custom-cake links (no product to inherit from).
// Standard bakery HSN 1905 → 5% inclusive. Admin can override later.
const CUSTOM_GST_RATE = 5;
const CUSTOM_GST_INCLUSIVE = true;

const suggestedSlotSchema = z
  .object({
    date: z.string().optional().nullable(),
    key: z.string().optional().nullable(),
    label: z.string().optional().nullable(),
  })
  .optional()
  .nullable();

export const createOrderLinkSchema = z
  .object({
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
  })
  .refine((v) => (v.kind === "CATALOG" ? !!v.productId : true), {
    message: "productId required for CATALOG kind",
    path: ["productId"],
  });

export type CreateOrderLinkInput = z.infer<typeof createOrderLinkSchema>;

export async function createOrderLink(input: CreateOrderLinkInput) {
  let productName = input.productName;
  let referenceImageUrl = input.referenceImageUrl ?? null;

  if (input.kind === "CATALOG" && input.productId) {
    const p = await prisma.product.findUnique({
      where: { id: input.productId },
      select: { id: true, name: true, images: true, isActive: true },
    });
    if (!p) throw HttpError.badRequest("Product not found");
    if (!p.isActive) throw HttpError.badRequest("Product is inactive");
    // Snapshot: use admin-provided name if any, else product name; same for image.
    if (!input.productName || input.productName === p.name)
      productName = p.name;
    if (!referenceImageUrl && p.images[0]) referenceImageUrl = p.images[0];
  }

  const expiresAt = input.expiresInDays
    ? new Date(Date.now() + input.expiresInDays * 24 * 3600 * 1000)
    : null;

  const suggestedDate = input.suggested?.date
    ? new Date(input.suggested.date)
    : null;

  const created = await prisma.orderLink.create({
    data: {
      token: tokenGen(),
      kind: input.kind,
      productId: input.productId ?? null,
      productName,
      sizeLabel: input.sizeLabel ?? null,
      sizeGrams: input.sizeGrams ?? null,
      flavourId: input.flavourId ?? null,
      flavourName: input.flavourName ?? null,
      referenceImageUrl,
      messageHint: input.messageHint ?? null,
      unitPrice: input.unitPrice,
      qty: input.qty,
      customerName: input.customerName ?? null,
      customerPhone: input.customerPhone ?? null,
      suggestedDate,
      suggestedSlotKey: input.suggested?.key ?? null,
      suggestedSlotLabel: input.suggested?.label ?? null,
      adminNotes: input.adminNotes ?? null,
      expiresAt,
    },
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
      kind: true,
      productName: true,
      sizeLabel: true,
      sizeGrams: true,
      flavourId: true,
      flavourName: true,
      referenceImageUrl: true,
      messageHint: true,
      unitPrice: true,
      qty: true,
      customerName: true,
      customerPhone: true,
      suggestedDate: true,
      suggestedSlotKey: true,
      suggestedSlotLabel: true,
      status: true,
      expiresAt: true,
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

  messageOnCake: z.string().trim().max(200).optional().nullable(),
  customerNotes: z.string().trim().max(500).optional().nullable(),

  qty: z.coerce.number().int().positive().optional(),
});

export type PlaceOrderLinkInput = z.infer<typeof placeOrderLinkSchema>;

export async function placeOrderFromLink(
  token: string,
  input: PlaceOrderLinkInput,
) {
  const link = await prisma.orderLink.findUnique({
    where: { token },
    include: {
      product: {
        select: { id: true, gstRate: true, priceIsGstInclusive: true },
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

  // Reject past dates (mirrors createOrder guard).
  const dt = new Date(input.deliveryDate);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  if (Number.isNaN(dt.getTime()) || dt.getTime() < todayStart.getTime()) {
    throw HttpError.badRequest(
      "Delivery date is in the past. Please pick a fresh date.",
    );
  }

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

  // Pricing + GST snapshot
  const finalQty = input.qty ?? link.qty;
  const unitPrice = Number(link.unitPrice);
  const gstRate =
    link.product?.gstRate != null
      ? Number(link.product.gstRate)
      : CUSTOM_GST_RATE;
  const inclusive =
    link.product?.priceIsGstInclusive != null
      ? link.product.priceIsGstInclusive
      : CUSTOM_GST_INCLUSIVE;

  const lineIncl = unitPrice * finalQty;
  const subtotal = lineIncl;
  const taxableAmount = inclusive ? lineIncl / (1 + gstRate / 100) : lineIncl;
  const gstAmount = inclusive
    ? lineIncl - taxableAmount
    : lineIncl * (gstRate / 100);

  const BUSINESS_STATE_CODE = "19";
  const isIntraState =
    input.fulfillment === "PICKUP" ||
    input.deliveryAddress?.stateCode === BUSINESS_STATE_CODE;
  const cgstAmount = isIntraState ? gstAmount / 2 : 0;
  const sgstAmount = isIntraState ? gstAmount / 2 : 0;
  const igstAmount = isIntraState ? 0 : gstAmount;

  const total = subtotal + deliveryFee;

  const orderNumber = buildOrderNumber();

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
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
        total,
        taxableAmount,
        cgstAmount,
        sgstAmount,
        igstAmount,
        paymentMethod: "cod",
        customerNotes: input.customerNotes ?? null,
        items: {
          create: [
            {
              productId: link.productId,
              productName: link.productName,
              productSlug: null,
              productImage: link.referenceImageUrl,
              sizeGrams: link.sizeGrams,
              sizeLabel: link.sizeLabel,
              flavourId: link.flavourId,
              flavourName: link.flavourName,
              messageOnCake: input.messageOnCake ?? link.messageHint ?? null,
              instructions: null,
              referenceImageUrl:
                link.kind === "CUSTOM" ? link.referenceImageUrl : null,
              deliveryDate: dt,
              deliverySlotKey: input.deliverySlotKey,
              deliverySlotLabel: input.deliverySlotLabel,
              unitPrice,
              qty: finalQty,
              lineTotal: lineIncl,
            },
          ],
        },
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
  kind: z.enum(["CUSTOM", "CATALOG"]).optional(),
  productId: z.string().nullable().optional(),
  productName: z.string().trim().min(2).optional(),
  sizeLabel: z.string().trim().nullable().optional(),
  sizeGrams: z.coerce.number().int().positive().nullable().optional(),
  flavourId: z.string().nullable().optional(),
  flavourName: z.string().trim().nullable().optional(),
  referenceImageUrl: z.string().url().nullable().optional(),
  messageHint: z.string().trim().max(200).nullable().optional(),
  unitPrice: z.coerce.number().nonnegative().optional(),
  qty: z.coerce.number().int().positive().optional(),
  customerName: z.string().trim().nullable().optional(),
  customerPhone: z.string().trim().nullable().optional(),
});

export type UpdateOrderLinkInput = z.infer<typeof updateOrderLinkSchema>;

export async function updateOrderLink(id: string, input: UpdateOrderLinkInput) {
  const existing = await prisma.orderLink.findUnique({
    where: { id },
    select: { id: true, status: true, kind: true, productId: true },
  });
  if (!existing) throw HttpError.notFound("Order link not found");

  const specKeys = [
    "kind",
    "productId",
    "productName",
    "sizeLabel",
    "sizeGrams",
    "flavourId",
    "flavourName",
    "referenceImageUrl",
    "messageHint",
    "unitPrice",
    "qty",
    "customerName",
    "customerPhone",
  ] as const;
  const editingSpec = specKeys.some((k) => input[k] !== undefined);
  if (editingSpec && existing.status !== "OPEN") {
    throw HttpError.badRequest(
      "Cannot edit a link that has already been used or cancelled",
    );
  }

  // Post-update kind determines what productId must look like.
  const finalKind = input.kind ?? existing.kind;
  const finalProductId =
    input.productId !== undefined ? input.productId : existing.productId;
  if (finalKind === "CATALOG" && !finalProductId) {
    throw HttpError.badRequest("A catalog link needs a product");
  }

  const data: Record<string, unknown> = {};
  if (input.status) data.status = input.status;
  if (input.adminNotes !== undefined) data.adminNotes = input.adminNotes;
  if (input.expiresInDays !== undefined) {
    data.expiresAt = input.expiresInDays
      ? new Date(Date.now() + input.expiresInDays * 24 * 3600 * 1000)
      : null;
  }
  for (const k of specKeys) {
    if (input[k] !== undefined) data[k] = input[k];
  }
  // Switching to CUSTOM clears the productId even if the caller didn't send it.
  if (finalKind === "CUSTOM") data.productId = null;

  return prisma.orderLink.update({
    where: { id },
    data,
    include: {
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

  const total = subtotal + deliveryFee;
  const orderNumber = buildOrderNumber();

  const order = await prisma.order.create({
    data: {
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
      total,
      taxableAmount,
      cgstAmount,
      sgstAmount,
      igstAmount,
      paymentMethod: "cod",
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

  return order;
}
