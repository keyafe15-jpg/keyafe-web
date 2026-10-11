import type { Order, OrderItem, OrderStatus } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { env } from "../../config/env.js";
import { sendWhatsAppTemplate, staffWhatsAppRecipients } from "../../lib/whatsapp.js";
import { logger } from "../../utils/logger.js";

type OrderForWhatsApp = Pick<
  Order,
  "id" | "orderNumber" | "customerName" | "customerPhone" | "fulfillment" | "total"
> & {
  items: Pick<OrderItem, "deliveryDate" | "deliverySlotLabel">[];
};

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name.trim() || "there";
}

function rupees(total: unknown): string {
  return String(Math.round(Number(total)));
}

function formatDay(d: Date): string {
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** One-line pickup / delivery summary for the staff new-order template. */
export function fulfillmentLine(order: OrderForWhatsApp): string {
  if (order.fulfillment === "PICKUP") {
    const dated = order.items.find((i) => i.deliveryDate);
    if (dated?.deliveryDate) {
      const slot = dated.deliverySlotLabel ? ` ${dated.deliverySlotLabel}` : "";
      return `Pickup ${formatDay(dated.deliveryDate)}${slot}`;
    }
    return "Pickup";
  }
  const dated = order.items.find((i) => i.deliveryDate);
  if (dated?.deliveryDate) {
    const slot = dated.deliverySlotLabel ? ` ${dated.deliverySlotLabel}` : "";
    return `Delivery ${formatDay(dated.deliveryDate)}${slot}`;
  }
  return "Delivery";
}

/** Buyer only — never the gift recipient's delivery phone. */
function customerPhone(order: Pick<OrderForWhatsApp, "customerPhone">): string {
  return order.customerPhone;
}

async function extraStaffPhones(): Promise<string[]> {
  const settings = await prisma.businessSettings.findFirst({ select: { supportPhone: true } });
  return settings?.supportPhone ? [settings.supportPhone] : [];
}

export async function notifyOrderPlacedWhatsApp(order: OrderForWhatsApp) {
  await Promise.all([
    sendWhatsAppTemplate({
      to: customerPhone(order),
      template: env.WHATSAPP_TPL_ORDER_CONFIRM,
      bodyParams: [firstName(order.customerName), order.orderNumber],
      buttonUrlSuffix: `${order.id}/success`,
    }),
    sendStaffNewOrderWhatsApp(order, await extraStaffPhones()),
  ]);
}

async function sendStaffNewOrderWhatsApp(order: OrderForWhatsApp, extraStaff: string[]) {
  const to = staffWhatsAppRecipients(extraStaff);
  if (to.length === 0) {
    logger.warn({ orderId: order.id }, "whatsapp staff skipped — no staff number");
    return;
  }
  await sendWhatsAppTemplate({
    to,
    template: env.WHATSAPP_TPL_NEW_ORDER_STAFF,
    bodyParams: [
      order.orderNumber,
      order.customerName,
      order.customerPhone,
      String(order.items.length),
      rupees(order.total),
      fulfillmentLine(order),
    ],
  });
}

export async function sendOrderStatusWhatsApp(
  order: OrderForWhatsApp,
  status: Extract<OrderStatus, "OUT_FOR_DELIVERY" | "DELIVERED">,
) {
  const template =
    status === "OUT_FOR_DELIVERY" ? env.WHATSAPP_TPL_OUT_FOR_DELIVERY : env.WHATSAPP_TPL_DELIVERED;
  await sendWhatsAppTemplate({
    to: customerPhone(order),
    template,
    bodyParams: [firstName(order.customerName), order.orderNumber],
  });
}

export async function notifyOrderCancelledWhatsApp(
  order: OrderForWhatsApp,
  by: "customer" | "admin",
) {
  const who = by === "customer" ? "Customer" : "Admin";
  const staff = staffWhatsAppRecipients(await extraStaffPhones());
  await Promise.all([
    sendWhatsAppTemplate({
      to: customerPhone(order),
      template: env.WHATSAPP_TPL_CANCELLED,
      bodyParams: [firstName(order.customerName), order.orderNumber],
    }),
    staff.length === 0
      ? Promise.resolve(
          logger.warn({ orderId: order.id }, "whatsapp staff skipped — no staff number"),
        )
      : sendWhatsAppTemplate({
          to: staff,
          template: env.WHATSAPP_TPL_CANCELLED_STAFF,
          bodyParams: [
            order.orderNumber,
            who,
            order.customerName,
            order.customerPhone,
            rupees(order.total),
          ],
        }),
  ]);
}
