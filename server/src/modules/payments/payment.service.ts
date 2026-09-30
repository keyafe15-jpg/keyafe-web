import type { PaymentAttempt, PaymentAttemptStatus, Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { env } from "../../config/env.js";
import { HttpError } from "../../utils/httpError.js";
import { logger } from "../../utils/logger.js";
import { notifyOrderPlaced } from "../orders/order.notify.js";
import {
  cashfreeEnabled,
  cashfreeMode,
  createCfOrder,
  getCfPayments,
  terminateCfOrder,
  type CfPayment,
} from "./cashfree.client.js";

export type PaymentState = "PAID" | "PENDING" | "FAILED" | "NOT_ONLINE";

export interface PaymentSession {
  orderNumber: string;
  paymentSessionId: string;
  mode: "sandbox" | "production";
  amount: number;
}

const money = (n: number) => Math.round(n * 100) / 100;

function assertCashfreeReady() {
  if (!cashfreeEnabled()) {
    throw HttpError.badRequest(
      "Online payment isn't available right now. Please choose cash on delivery.",
    );
  }
}

function cfCustomerPhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  return digits.slice(-10);
}

async function loadOrderForPayment(where: Prisma.OrderWhereUniqueInput) {
  const order = await prisma.order.findUnique({
    where,
    include: { paymentAttempts: { orderBy: { createdAt: "asc" } } },
  });
  if (!order) throw HttpError.notFound("Order not found");
  return order;
}

/**
 * Amount to collect online. The first attempt fixes it (full total, or the
 * upfront amount the customer chose on an order link); retries reuse it.
 */
function amountToCollect(
  order: { total: Prisma.Decimal; advanceAmount: Prisma.Decimal },
  attempts: PaymentAttempt[],
  requested?: number,
) {
  const total = Number(order.total);
  const outstanding = money(total - Number(order.advanceAmount));
  const previous = attempts.at(-1);
  const amount = requested ?? (previous ? Number(previous.amount) : outstanding);
  return money(Math.min(Math.max(amount, 0), outstanding));
}

/**
 * Opens (or reuses) a Cashfree order for this order and returns the session id
 * the browser hands to Cashfree's hosted checkout.
 */
export async function createPaymentSession(
  orderNumber: string,
  opts: { amount?: number } = {},
): Promise<PaymentSession> {
  assertCashfreeReady();
  const order = await loadOrderForPayment({ orderNumber });

  if (order.paymentMethod !== "cashfree") {
    throw HttpError.badRequest("This order isn't set up for online payment");
  }
  if (order.status === "CANCELLED") {
    throw HttpError.badRequest("This order was cancelled");
  }
  if (order.paidAt || order.paymentAttempts.some((a) => a.status === "SUCCESS")) {
    throw HttpError.conflict("This order is already paid");
  }

  const amount = amountToCollect(order, order.paymentAttempts, opts.amount);
  if (amount < 1) throw HttpError.badRequest("Nothing left to pay on this order");

  // Reuse a still-open attempt for the same amount instead of stacking up
  // gateway orders when the customer taps "Pay" twice or comes back.
  const open = order.paymentAttempts
    .filter((a) => a.status === "CREATED" && a.paymentSessionId && Number(a.amount) === amount)
    .at(-1);
  if (open && Date.now() - open.createdAt.getTime() < 20 * 60 * 1000) {
    return {
      orderNumber,
      paymentSessionId: open.paymentSessionId!,
      mode: cashfreeMode,
      amount,
    };
  }

  const n = order.paymentAttempts.length;
  const gatewayOrderId = n === 0 ? orderNumber : `${orderNumber}-${n + 1}`;

  // Row first so the chosen amount survives even if the gateway call fails.
  // Older attempts stay open: reconcile keeps checking them in case one of
  // those sessions gets paid late.
  const attempt = await prisma.paymentAttempt.create({
    data: { orderId: order.id, gatewayOrderId, amount, provider: "cashfree" },
  });

  try {
    const cf = await createCfOrder({
      gatewayOrderId,
      amount,
      customer: {
        id: order.userId ?? `G${cfCustomerPhone(order.customerPhone)}`,
        name: order.customerName,
        phone: cfCustomerPhone(order.customerPhone),
        email: order.customerEmail,
      },
      returnUrl: `${env.CLIENT_ORIGIN}/order/${encodeURIComponent(orderNumber)}/success?paid=1`,
      notifyUrl: env.PUBLIC_BASE_URL.startsWith("https://")
        ? `${env.PUBLIC_BASE_URL}/api/payments/cashfree/webhook`
        : undefined,
      note: `Keyafe order ${orderNumber}`,
    });
    await prisma.paymentAttempt.update({
      where: { id: attempt.id },
      data: { paymentSessionId: cf.payment_session_id, raw: cf as unknown as Prisma.JsonObject },
    });
    return { orderNumber, paymentSessionId: cf.payment_session_id, mode: cashfreeMode, amount };
  } catch (err) {
    await prisma.paymentAttempt.update({ where: { id: attempt.id }, data: { status: "EXPIRED" } });
    throw err;
  }
}

function attemptStatusFrom(payments: CfPayment[]): {
  status: PaymentAttemptStatus;
  payment: CfPayment | null;
} {
  const success = payments.find((p) => p.payment_status === "SUCCESS");
  if (success) return { status: "SUCCESS", payment: success };
  if (payments.some((p) => p.payment_status === "PENDING")) {
    return { status: "CREATED", payment: null };
  }
  const last = payments
    .filter((p) => p.payment_status !== "NOT_ATTEMPTED")
    .sort(
      (a, b) => new Date(b.payment_time ?? 0).getTime() - new Date(a.payment_time ?? 0).getTime(),
    )[0];
  if (!last) return { status: "CREATED", payment: null };
  return {
    status: last.payment_status === "USER_DROPPED" ? "USER_DROPPED" : "FAILED",
    payment: last,
  };
}

/**
 * Asks Cashfree what happened to every open attempt and folds the answer into
 * the order. Safe to call any number of times (return page, polling, webhook,
 * admin refresh): the PAID transition is a conditional update, so notifications
 * fire exactly once.
 */
export async function reconcilePayment(orderId: string): Promise<PaymentState> {
  const order = await loadOrderForPayment({ id: orderId });
  if (order.paymentMethod !== "cashfree") return "NOT_ONLINE";
  if (order.paidAt) return "PAID";
  if (!cashfreeEnabled()) return "PENDING";

  for (const attempt of order.paymentAttempts) {
    if (attempt.status === "SUCCESS" || attempt.status === "EXPIRED") continue;
    if (!attempt.paymentSessionId) continue;

    let payments: CfPayment[];
    try {
      payments = await getCfPayments(attempt.gatewayOrderId);
    } catch (err) {
      logger.warn(
        { err, gatewayOrderId: attempt.gatewayOrderId },
        "cashfree payments lookup failed",
      );
      continue;
    }

    const { status, payment } = attemptStatusFrom(payments);
    if (
      status === "SUCCESS" &&
      payment &&
      Math.abs(payment.payment_amount - Number(attempt.amount)) > 0.01
    ) {
      logger.error(
        {
          gatewayOrderId: attempt.gatewayOrderId,
          paid: payment.payment_amount,
          expected: attempt.amount,
        },
        "cashfree amount mismatch — not marking paid",
      );
      continue;
    }

    attempt.status = status;
    await prisma.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        status,
        gatewayPaymentId: payment ? String(payment.cf_payment_id) : attempt.gatewayPaymentId,
        paymentGroup: payment?.payment_group ?? attempt.paymentGroup,
        raw: payments as unknown as Prisma.JsonArray,
      },
    });
  }

  const paidOnline = money(
    order.paymentAttempts
      .filter((a) => a.status === "SUCCESS")
      .reduce((sum, a) => sum + Number(a.amount), 0),
  );

  if (paidOnline > 0) {
    const total = Number(order.total);
    const advanceAmount = money(Math.min(total, Number(order.advanceAmount) + paidOnline));
    const { count } = await prisma.order.updateMany({
      where: { id: order.id, paidAt: null },
      data: {
        paidAt: new Date(),
        advanceAmount,
        paymentStatus: advanceAmount >= total ? "PAID" : "PARTIAL",
      },
    });
    if (count === 1) {
      const fresh = await prisma.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { items: true },
      });
      notifyOrderPlaced(fresh);
    }
    return "PAID";
  }

  const stillOpen = order.paymentAttempts.some((a) => a.status === "CREATED");
  if (!stillOpen && order.paymentAttempts.length > 0 && order.paymentStatus === "PENDING") {
    await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: "FAILED" } });
    return "FAILED";
  }
  return order.paymentStatus === "FAILED" && !stillOpen ? "FAILED" : "PENDING";
}

export async function reconcileByOrderNumber(orderNumber: string) {
  const order = await prisma.order.findUnique({ where: { orderNumber }, select: { id: true } });
  if (!order) throw HttpError.notFound("Order not found");
  return reconcilePayment(order.id);
}

export async function reconcileByGatewayOrderId(gatewayOrderId: string) {
  const attempt = await prisma.paymentAttempt.findUnique({
    where: { gatewayOrderId },
    select: { orderId: true },
  });
  if (!attempt) return null;
  return reconcilePayment(attempt.orderId);
}

/**
 * Customer gave up on paying online — keep the storefront order as cash on
 * delivery and release it to the kitchen. Order links stay online-only since
 * the baker asked for an upfront payment.
 */
export async function switchToCashOnDelivery(orderNumber: string) {
  const order = await loadOrderForPayment({ orderNumber });
  if (order.paymentMethod !== "cashfree") {
    throw HttpError.badRequest("This order isn't waiting for an online payment");
  }
  if (order.source !== "STOREFRONT") {
    throw HttpError.badRequest("This order needs an online payment to be confirmed");
  }
  if (order.status === "CANCELLED") throw HttpError.badRequest("This order was cancelled");

  if ((await reconcilePayment(order.id)) === "PAID") {
    throw HttpError.conflict("Your payment went through, so this order is already paid");
  }

  const { count } = await prisma.order.updateMany({
    where: { id: order.id, paymentMethod: "cashfree", paidAt: null },
    data: { paymentMethod: "cod", paymentStatus: "PENDING" },
  });
  if (count === 1) {
    for (const a of order.paymentAttempts) {
      if (a.status === "SUCCESS" || a.status === "EXPIRED" || !a.paymentSessionId) continue;
      await terminateCfOrder(a.gatewayOrderId).catch((err) => {
        logger.warn({ err, gatewayOrderId: a.gatewayOrderId }, "cashfree terminate failed");
      });
    }
    await prisma.paymentAttempt.updateMany({
      where: { orderId: order.id, status: { not: "SUCCESS" } },
      data: { status: "EXPIRED" },
    });
    const fresh = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { items: true },
    });
    notifyOrderPlaced(fresh);
  }
}

export function paymentConfig() {
  return { cashfreeEnabled: cashfreeEnabled(), mode: cashfreeMode };
}
