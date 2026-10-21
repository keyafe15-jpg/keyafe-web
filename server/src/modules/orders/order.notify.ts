import type { Order, OrderItem } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { emitNewOrder } from "../../lib/events.js";
import { logger } from "../../utils/logger.js";
import { sendEmail } from "../email/email.service.js";
import {
  renderAdminNotification,
  renderCustomerConfirmation,
  renderCustomerOrderUpdated,
} from "../email/templates.js";
import { getBusinessContact } from "../store/businessContact.js";
import { invoiceAttachmentIfPaid } from "./invoice.service.js";
import { notifyOrderPlacedWhatsApp, notifyOrderUpdatedWhatsApp } from "./order.whatsapp.js";

type OrderWithItems = Order & { items: OrderItem[] };

/**
 * "New order" side effects: customer confirmation (with the tax invoice when
 * already paid), the admin email, WhatsApp templates (customer + staff), and
 * the live SSE/push alert. COD orders fire this at placement; online-payment
 * orders only once the gateway confirms, so the kitchen never sees abandoned
 * checkouts. Never throws.
 */
export function notifyOrderPlaced(order: OrderWithItems) {
  void sendOrderEmails(order).catch((err) => {
    logger.error({ err, orderId: order.id }, "order email dispatch failed");
  });
  void notifyOrderPlacedWhatsApp(order).catch((err) => {
    logger.error({ err, orderId: order.id }, "order whatsapp dispatch failed");
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

export function orderUpdateDueLine(args: {
  newTotal: number;
  paid: number;
  refundDue: number;
  refundedOnline: number;
}): string {
  const stillDue = Math.max(0, Math.round(args.newTotal - args.paid));
  const refund = Math.round(args.refundDue + args.refundedOnline);
  if (stillDue > 0) return `₹${stillDue} still to pay`;
  if (refund > 0) return `₹${refund} will be refunded`;
  return "No extra to pay";
}

/**
 * Customer-only notice after admin item / price / add-on edits. Fire-and-forget.
 */
export function notifyOrderUpdated(
  order: OrderWithItems,
  extras: { previousTotal: number; refundDue: number; refundedOnline: number },
) {
  const dueLine = orderUpdateDueLine({
    newTotal: Number(order.total),
    paid: Number(order.advanceAmount),
    refundDue: extras.refundDue,
    refundedOnline: extras.refundedOnline,
  });
  void sendOrderUpdatedEmail(order, extras.previousTotal, dueLine).catch((err) => {
    logger.error({ err, orderId: order.id }, "order update email dispatch failed");
  });
  void notifyOrderUpdatedWhatsApp(order, { dueLine }).catch((err) => {
    logger.error({ err, orderId: order.id }, "order update whatsapp dispatch failed");
  });
}

async function sendOrderUpdatedEmail(
  order: OrderWithItems,
  previousTotal: number,
  dueLine: string,
) {
  if (!order.customerEmail) return;
  const [settings, contact] = await Promise.all([
    prisma.businessSettings.findFirst({
      select: { supportEmail: true, orderNotificationEmail: true },
    }),
    getBusinessContact(),
  ]);
  const adminRecipient = settings?.orderNotificationEmail || settings?.supportEmail;
  const { subject, html } = renderCustomerOrderUpdated(order, contact, {
    previousTotal,
    dueLine,
  });
  void sendEmail({
    to: order.customerEmail,
    subject,
    html,
    replyTo: adminRecipient ?? undefined,
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
