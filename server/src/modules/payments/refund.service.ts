import { randomBytes } from "node:crypto";
import type { GatewayRefundStatus, Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";
import { logger } from "../../utils/logger.js";
import { cashfreeEnabled, createCfRefund, getCfRefund, type CfRefund } from "./cashfree.client.js";

const money = (n: number) => Math.round(n * 100) / 100;

/** Successful online payments on the order, each with what can still go back. */
async function refundableAttempts(orderId: string) {
  const attempts = await prisma.paymentAttempt.findMany({
    where: { orderId, status: "SUCCESS" },
    include: { refunds: { where: { status: { not: "CANCELLED" } }, select: { amount: true } } },
    orderBy: { createdAt: "desc" },
  });
  return attempts.map((a) => ({
    id: a.id,
    gatewayOrderId: a.gatewayOrderId,
    left: money(Number(a.amount) - a.refunds.reduce((s, r) => s + Number(r.amount), 0)),
  }));
}

/** The most one online refund can send back on this order. */
export async function onlineRefundable(orderId: string): Promise<number> {
  const attempts = await refundableAttempts(orderId);
  return attempts.reduce((max, a) => Math.max(max, a.left), 0);
}

export interface SentRefund {
  orderId: string;
  paymentAttemptId: string;
  gatewayOrderId: string;
  refundId: string;
  gatewayRefundId: string | null;
  amount: number;
  status: GatewayRefundStatus;
  note: string | null;
  raw: CfRefund;
}

/**
 * Sends `amount` back to the customer's online payment. Nothing is saved here:
 * the caller stores the result (with `refundRecord`) alongside its own change,
 * so a gateway failure leaves the order untouched.
 */
export async function sendOnlineRefund(
  orderId: string,
  amount: number,
  note: string | null,
): Promise<SentRefund> {
  if (!cashfreeEnabled()) {
    throw HttpError.badRequest(
      "Online refunds aren't available right now. Refund the customer manually instead.",
    );
  }
  const value = money(amount);
  const attempts = await refundableAttempts(orderId);
  const attempt = attempts.find((a) => a.left >= value);
  if (!attempt) {
    const max = attempts.reduce((m, a) => Math.max(m, a.left), 0);
    throw HttpError.badRequest(
      max > 0
        ? `Only ₹${max.toFixed(2)} can go back to the customer's online payment. Refund the rest manually.`
        : "Nothing paid online is left to refund on this order. Refund the customer manually.",
    );
  }

  const refundId = `RF${Date.now().toString(36)}${randomBytes(4).toString("hex")}`.toUpperCase();
  const cf = await createCfRefund({
    gatewayOrderId: attempt.gatewayOrderId,
    refundId,
    amount: value,
    note: note ?? undefined,
  });
  return {
    orderId,
    paymentAttemptId: attempt.id,
    gatewayOrderId: attempt.gatewayOrderId,
    refundId,
    gatewayRefundId: cf.cf_refund_id != null ? String(cf.cf_refund_id) : null,
    amount: value,
    status: cf.refund_status ?? "PENDING",
    note,
    raw: cf,
  };
}

export function refundRecord(
  sent: SentRefund,
  extra: { creditNoteId?: string; createdByName?: string | null } = {},
): Prisma.GatewayRefundUncheckedCreateInput {
  return {
    orderId: sent.orderId,
    paymentAttemptId: sent.paymentAttemptId,
    gatewayOrderId: sent.gatewayOrderId,
    refundId: sent.refundId,
    gatewayRefundId: sent.gatewayRefundId,
    amount: sent.amount,
    status: sent.status,
    note: sent.note,
    raw: sent.raw as unknown as Prisma.JsonObject,
    creditNoteId: extra.creditNoteId ?? null,
    createdByName: extra.createdByName ?? null,
  };
}

/**
 * The money already left through the gateway but saving the caller's change
 * failed. Keep at least the refund row so it isn't lost, then rethrow.
 */
export async function keepRefundAfterFailure(sent: SentRefund, err: unknown): Promise<never> {
  logger.error(
    { err, refundId: sent.refundId, orderId: sent.orderId },
    "refund sent but not saved",
  );
  await prisma.gatewayRefund.create({ data: refundRecord(sent) }).catch((saveErr) => {
    logger.error({ saveErr, sent }, "could not record sent refund");
  });
  throw new HttpError(
    500,
    `₹${sent.amount.toFixed(2)} was refunded to the customer's online payment, but saving the change failed. Don't refund again; contact support with refund ${sent.refundId}.`,
  );
}

/** Re-reads one refund's status from the gateway. */
export async function syncGatewayRefund(refundId: string) {
  const row = await prisma.gatewayRefund.findUnique({ where: { refundId } });
  if (!row || !cashfreeEnabled()) return row;
  const cf = await getCfRefund(row.gatewayOrderId, row.refundId);
  return prisma.gatewayRefund.update({
    where: { id: row.id },
    data: {
      status: cf.refund_status,
      gatewayRefundId: cf.cf_refund_id != null ? String(cf.cf_refund_id) : row.gatewayRefundId,
      raw: cf as unknown as Prisma.JsonObject,
    },
  });
}

/** Refreshes refunds still in flight; failures are logged, never thrown. */
export async function syncPendingRefunds(orderId: string) {
  const pending = await prisma.gatewayRefund.findMany({
    where: { orderId, status: { in: ["PENDING", "ONHOLD"] } },
    select: { refundId: true },
  });
  for (const { refundId } of pending) {
    await syncGatewayRefund(refundId).catch((err) => {
      logger.warn({ err, refundId }, "cashfree refund status lookup failed");
    });
  }
}
