import type { Order, OrderItem } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { emitNewOrder } from "../../lib/events.js";
import { logger } from "../../utils/logger.js";
import { sendEmail } from "../email/email.service.js";
import { renderAdminNotification, renderCustomerConfirmation } from "../email/templates.js";
import { getBusinessContact } from "../store/businessContact.js";
import { invoiceAttachmentIfPaid } from "./invoice.service.js";

type OrderWithItems = Order & { items: OrderItem[] };

/**
 * "New order" side effects: customer confirmation (with the tax invoice when
 * already paid), the admin email, and the live SSE/push alert. COD orders fire
 * this at placement; online-payment orders only once the gateway confirms, so
 * the kitchen never sees abandoned checkouts. Never throws.
 */
export function notifyOrderPlaced(order: OrderWithItems) {
  void sendOrderEmails(order).catch((err) => {
    logger.error({ err, orderId: order.id }, "order email dispatch failed");
  });

  emitNewOrder({
    id: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    total: order.total.toString(),
    source: order.source,
    itemCount: order.items.length,
    createdAt: order.createdAt.toISOString(),
  });
}

async function sendOrderEmails(order: OrderWithItems) {
  const [settings, contact] = await Promise.all([
    prisma.businessSettings.findFirst({
      select: { supportEmail: true, orderNotificationEmail: true },
    }),
    getBusinessContact(),
  ]);
  const adminRecipient = settings?.orderNotificationEmail || settings?.supportEmail;

  if (order.customerEmail) {
    const { subject, html } = renderCustomerConfirmation(order, contact);
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
    const { subject, html } = renderAdminNotification(order, contact);
    void sendEmail({
      to: adminRecipient,
      subject,
      html,
      replyTo: order.customerEmail ?? undefined,
    });
  }
}
