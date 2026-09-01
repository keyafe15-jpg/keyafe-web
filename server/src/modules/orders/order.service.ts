import { z } from "zod";
import { customAlphabet } from "nanoid";
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
import { assertKitchenOpenOn } from "../store/store.service.js";

const orderNoSuffix = customAlphabet("ABCDEFGHJKMNPQRSTUVWXYZ23456789", 6);

const addressSchema = z.object({
  line1: z.string().trim().min(3),
  line2: z.string().trim().optional().nullable(),
  landmark: z.string().trim().optional().nullable(),
  mapSearchQuery: z
    .string()
    .trim()
    .min(3, "Tell us what to search on Uber / Rapido")
    .max(200),
  pincode: z.string().regex(/^\d{6}$/),
  city: z.string().trim().optional().nullable(),
  area: z.string().trim().optional().nullable(),
  state: z.string().trim().optional().nullable(),
  stateCode: z.string().trim().optional().nullable(),
});

const itemSchema = z.object({
  productId: z.string().min(1),
  sizeGrams: z.number().int().positive().nullable().optional(),
  sizeLabel: z.string().trim().nullable().optional(),
  flavourId: z.string().nullable().optional(),
  flavourName: z.string().trim().nullable().optional(),
  messageOnCake: z.string().trim().nullable().optional(),
  instructions: z.string().trim().nullable().optional(),
  unitPrice: z.number().nonnegative(),
  qty: z.number().int().positive(),
  deliveryDate: z.string().min(1).nullable().optional(),
  deliverySlotKey: z.string().min(1).nullable().optional(),
  deliverySlotLabel: z.string().min(1).nullable().optional(),
});

export const createOrderSchema = z.object({
  userId: z.string().min(1).optional(),
  customerName: z.string().trim().min(2, "Name is required"),
  customerPhone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s]{7,15}$/, "Enter a valid phone number"),
  customerEmail: z.string().email().trim().optional().nullable(),

  fulfillment: z.enum(["DELIVERY", "PICKUP"]),
  deliveryAddress: addressSchema.optional().nullable(),

  customerNotes: z.string().trim().max(500).optional().nullable(),
  paymentMethod: z.enum(["cod", "upi", "razorpay"]).default("cod"),

  items: z.array(itemSchema).min(1, "Add at least one item to the cart"),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export function buildOrderNumber(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `KEY-${yy}${mm}${dd}-${orderNoSuffix()}`;
}

export async function createOrder(input: CreateOrderInput) {
  if (input.fulfillment === "DELIVERY" && !input.deliveryAddress) {
    throw HttpError.badRequest(
      "Delivery address is required for delivery orders",
    );
  }
  // Reject items whose delivery date is in the past. Compares against
  // midnight local (day-level check); slot-level expiry is enforced client-side.
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  for (const item of input.items) {
    if (!item.deliveryDate) continue;
    const d = new Date(item.deliveryDate);
    if (Number.isNaN(d.getTime())) {
      throw HttpError.badRequest("Invalid delivery date");
    }
    if (d.getTime() < todayStart.getTime()) {
      throw HttpError.badRequest(
        "Delivery date is in the past. Please pick a new date on the product page.",
      );
    }
    await assertKitchenOpenOn(item.deliveryDate);
  }

  // Load current product snapshots so we don't trust the client-provided prices blindly
  // and can capture name/slug/image at the time of order.
  const productIds = [...new Set(input.items.map((i) => i.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      name: true,
      slug: true,
      images: true,
      isActive: true,
      isAvailable: true,
      gstRate: true,
      priceIsGstInclusive: true,
    },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));
  for (const item of input.items) {
    const p = productMap.get(item.productId);
    if (!p) throw HttpError.badRequest(`Product ${item.productId} not found`);
    if (!p.isActive || !p.isAvailable) {
      throw HttpError.badRequest(`Product "${p.name}" is no longer available`);
    }
  }

  // Delivery fee lookup — pincode-based. Pickup orders skip this.
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

  const subtotal = input.items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);
  const total = subtotal + deliveryFee;

  // GST breakup — per item to respect different HSN rates, then aggregated
  // and split into CGST+SGST (intra-state, i.e. West Bengal) or IGST (other).
  const BUSINESS_STATE_CODE = "19";
  let taxableAmount = 0;
  let gstAmount = 0;
  for (const i of input.items) {
    const p = productMap.get(i.productId)!;
    const rate = Number(p.gstRate);
    const lineIncl = i.unitPrice * i.qty;
    if (p.priceIsGstInclusive) {
      const base = lineIncl / (1 + rate / 100);
      taxableAmount += base;
      gstAmount += lineIncl - base;
    } else {
      taxableAmount += lineIncl;
      gstAmount += lineIncl * (rate / 100);
    }
  }
  const isIntraState =
    input.fulfillment === "PICKUP" ||
    input.deliveryAddress?.stateCode === BUSINESS_STATE_CODE;
  const cgstAmount = isIntraState ? gstAmount / 2 : 0;
  const sgstAmount = isIntraState ? gstAmount / 2 : 0;
  const igstAmount = isIntraState ? 0 : gstAmount;

  const orderNumber = buildOrderNumber();

  const created = await prisma.order.create({
    data: {
      userId: input.userId ?? null,
      orderNumber,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail ?? null,
      fulfillment: input.fulfillment,
      deliveryAddress: input.deliveryAddress ?? undefined,
      subtotal,
      deliveryFee,
      total,
      taxableAmount,
      cgstAmount,
      sgstAmount,
      igstAmount,
      paymentMethod: input.paymentMethod,
      source: "STOREFRONT",
      customerNotes: input.customerNotes ?? null,
      items: {
        create: input.items.map((i) => {
          const p = productMap.get(i.productId)!;
          return {
            productId: p.id,
            productName: p.name,
            productSlug: p.slug,
            productImage: p.images[0] ?? null,
            sizeGrams: i.sizeGrams ?? null,
            sizeLabel: i.sizeLabel ?? null,
            flavourId: i.flavourId ?? null,
            flavourName: i.flavourName ?? null,
            messageOnCake: i.messageOnCake ?? null,
            instructions: i.instructions ?? null,
            deliveryDate: i.deliveryDate ? new Date(i.deliveryDate) : null,
            deliverySlotKey: i.deliverySlotKey,
            deliverySlotLabel: i.deliverySlotLabel,
            unitPrice: i.unitPrice,
            qty: i.qty,
            lineTotal: i.unitPrice * i.qty,
          };
        }),
      },
    },
    include: { items: true },
  });

  // Fire-and-forget notifications. Failures are logged but never fail the order.
  void sendOrderEmails(created).catch((err) => {
    logger.error({ err, orderId: created.id }, "order email dispatch failed");
  });

  emitNewOrder({
    id: created.id,
    orderNumber: created.orderNumber,
    customerName: created.customerName,
    total: created.total.toString(),
    source: "STOREFRONT",
    itemCount: created.items.length,
    createdAt: created.createdAt.toISOString(),
  });

  return created;
}

async function sendOrderEmails(order: Awaited<ReturnType<typeof createOrder>>) {
  const settings = await prisma.businessSettings.findFirst({
    select: {
      supportEmail: true,
      orderNotificationEmail: true,
    },
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

export async function getOrderById(id: string) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!order) throw HttpError.notFound("Order not found");
  return order;
}

export async function getOrderByNumber(orderNumber: string) {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { items: true },
  });
  if (!order) throw HttpError.notFound("Order not found");
  return order;
}
