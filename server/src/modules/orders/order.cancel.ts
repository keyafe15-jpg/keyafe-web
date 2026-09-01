import type { OrderItem, OrderStatus } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";
import { sendEmail } from "../email/email.service.js";
import {
  renderAdminCancelled,
  renderCustomerCancelled,
} from "../email/templates.js";
import { logger } from "../../utils/logger.js";
import { emitOrderCancelled } from "../../lib/events.js";
import { sendStaffWhatsApp } from "../../lib/whatsapp.js";

/** Customers cannot cancel once the kitchen has started (or later). */
const KITCHEN_OR_LATER: ReadonlySet<OrderStatus> = new Set([
  "IN_KITCHEN",
  "READY",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
]);

/** Safety window if the order is still PENDING/CONFIRMED. */
export const CUSTOMER_CANCEL_CUTOFF_HOURS = 10;

const BAKERY_TZ_OFFSET = "+05:30";

/** Slot start in bakery local time (when the window opens). */
const SLOT_START: Record<string, { hour: number; minute: number }> = {
  morning: { hour: 9, minute: 0 },
  afternoon: { hour: 12, minute: 0 },
  evening: { hour: 16, minute: 0 },
  "late-evening": { hour: 20, minute: 0 },
  midnight: { hour: 23, minute: 0 },
  SAME_DAY: { hour: 11, minute: 0 },
};

export interface CustomerCancelState {
  allowed: boolean;
  reason: string | null;
  /** ISO timestamp after which online cancel is blocked (10h before delivery). */
  deadlineAt: string | null;
}

type OrderForCancel = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  customerName: string;
  customerEmail: string | null;
  items: Pick<
    OrderItem,
    "deliveryDate" | "deliverySlotKey" | "deliverySlotLabel"
  >[];
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function utcYmd(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function slotStartAt(deliveryDate: Date, slotKey: string | null): Date {
  const start = SLOT_START[slotKey ?? ""] ?? { hour: 11, minute: 0 };
  const ymd = utcYmd(deliveryDate);
  return new Date(
    `${ymd}T${pad2(start.hour)}:${pad2(start.minute)}:00${BAKERY_TZ_OFFSET}`,
  );
}

/** Earliest dated item's slot start. Null when every line is pan-India (no date). */
export function earliestDeliveryAt(
  items: Pick<OrderItem, "deliveryDate" | "deliverySlotKey">[],
): Date | null {
  let earliest: Date | null = null;
  for (const item of items) {
    if (!item.deliveryDate) continue;
    const at = slotStartAt(item.deliveryDate, item.deliverySlotKey);
    if (!earliest || at.getTime() < earliest.getTime()) earliest = at;
  }
  return earliest;
}

export function getCustomerCancelState(
  order: Pick<OrderForCancel, "status" | "items">,
  now = new Date(),
): CustomerCancelState {
  if (order.status === "CANCELLED") {
    return {
      allowed: false,
      reason: "This order is already cancelled.",
      deadlineAt: null,
    };
  }

  if (order.status === "DELIVERED") {
    return {
      allowed: false,
      reason: "This order has already been delivered.",
      deadlineAt: null,
    };
  }

  if (KITCHEN_OR_LATER.has(order.status)) {
    return {
      allowed: false,
      reason:
        "This order is already being prepared and can't be cancelled online. Please call the bakery.",
      deadlineAt: null,
    };
  }

  const deliveryAt = earliestDeliveryAt(order.items);
  if (!deliveryAt) {
    return { allowed: true, reason: null, deadlineAt: null };
  }

  const deadlineAt = new Date(
    deliveryAt.getTime() - CUSTOMER_CANCEL_CUTOFF_HOURS * 60 * 60 * 1000,
  );

  if (now.getTime() >= deadlineAt.getTime()) {
    return {
      allowed: false,
      reason: `Online cancellations close ${CUSTOMER_CANCEL_CUTOFF_HOURS} hours before delivery. Please call the bakery if you need help.`,
      deadlineAt: deadlineAt.toISOString(),
    };
  }

  return {
    allowed: true,
    reason: null,
    deadlineAt: deadlineAt.toISOString(),
  };
}

export function withCustomerCancel<T extends Pick<OrderForCancel, "status" | "items">>(
  order: T,
) {
  return { ...order, customerCancel: getCustomerCancelState(order) };
}

export async function cancelOrderAsCustomer(idOrNumber: string) {
  const key = idOrNumber;
  const existing = key.startsWith("KEY-")
    ? await prisma.order.findUnique({
        where: { orderNumber: key },
        include: { items: true },
      })
    : await prisma.order.findUnique({
        where: { id: key },
        include: { items: true },
      });

  if (!existing) throw HttpError.notFound("Order not found");

  const state = getCustomerCancelState(existing);
  if (!state.allowed) {
    throw HttpError.conflict(state.reason ?? "This order can't be cancelled");
  }

  const updated = await prisma.order.update({
    where: { id: existing.id },
    data: { status: "CANCELLED" },
    include: { items: true },
  });

  void notifyCancelled(updated, "customer").catch((err) => {
    logger.error(
      { err, orderId: updated.id },
      "cancel notification failed",
    );
  });

  return withCustomerCancel(updated);
}

export async function cancelOrderAsAdmin(id: string) {
  const existing = await prisma.order.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!existing) throw HttpError.notFound("Order not found");
  if (existing.status === "CANCELLED") {
    return existing;
  }

  const updated = await prisma.order.update({
    where: { id },
    data: { status: "CANCELLED" },
    include: { items: true },
  });

  void notifyCancelled(updated, "admin").catch((err) => {
    logger.error(
      { err, orderId: updated.id },
      "cancel notification failed",
    );
  });

  return updated;
}

async function notifyCancelled(
  order: Awaited<ReturnType<typeof prisma.order.update>> & {
    items: OrderItem[];
  },
  by: "customer" | "admin",
) {
  const settings = await prisma.businessSettings.findFirst({
    select: {
      supportEmail: true,
      orderNotificationEmail: true,
      supportPhone: true,
    },
  });
  const adminRecipients = [
    ...new Set(
      [settings?.orderNotificationEmail, settings?.supportEmail].filter(
        (e): e is string => Boolean(e),
      ),
    ),
  ];

  emitOrderCancelled({
    id: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    total: order.total.toString(),
    itemCount: order.items.length,
    cancelledBy: by,
    cancelledAt: new Date().toISOString(),
  });

  if (order.customerEmail) {
    const { subject, html } = renderCustomerCancelled(order);
    void sendEmail({
      to: order.customerEmail,
      subject,
      html,
      replyTo: adminRecipients[0],
    });
  }

  if (adminRecipients.length > 0) {
    const { subject, html } = renderAdminCancelled(order, by);
    void sendEmail({
      to: adminRecipients,
      subject,
      html,
      replyTo: order.customerEmail ?? undefined,
    });
  } else {
    logger.warn(
      { orderId: order.id },
      "cancel email skipped — no support/orderNotification email on BusinessSettings",
    );
  }

  const who = by === "customer" ? "Customer" : "Admin";
  const waBody = [
    `Order cancelled · ${order.orderNumber}`,
    `${who} cancelled an order from ${order.customerName}`,
    `${order.customerPhone} · ₹${Number(order.total).toFixed(0)} · ${order.items.length} item${order.items.length === 1 ? "" : "s"}`,
  ].join("\n");

  await sendStaffWhatsApp(
    waBody,
    settings?.supportPhone ? [settings.supportPhone] : [],
  );
}
