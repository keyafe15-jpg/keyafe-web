import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { HttpError } from "../../utils/httpError.js";
import {
  MAX_ORDER_PAYMENTS,
  MAX_PAYMENT_SCREENSHOTS,
  OFFLINE_PAYMENT_METHODS,
  type OfflinePaymentMethod,
} from "../../lib/paymentLabel.js";
import { roundMoney } from "../coupons/coupon.service.js";

export const orderPaymentInputSchema = z.object({
  method: z.enum(OFFLINE_PAYMENT_METHODS),
  amount: z.coerce.number().positive(),
  screenshotUrl: z.string().url().optional().nullable(),
});

export type OrderPaymentInput = z.infer<typeof orderPaymentInputSchema>;

export type OrderPaymentSummary = {
  advanceAmount: number;
  paymentStatus: "PENDING" | "PARTIAL" | "PAID";
  paymentMethod: string;
  paymentMode: "FULL" | "ADVANCE";
  paymentScreenshotUrls: string[];
};

type Tx = Prisma.TransactionClient;

type LineLike = {
  method: string;
  amount: unknown;
  screenshotUrl?: string | null;
};

function asMethod(method: string): OfflinePaymentMethod {
  return (OFFLINE_PAYMENT_METHODS as readonly string[]).includes(method)
    ? (method as OfflinePaymentMethod)
    : "cash";
}

export function summarizePayments(lines: LineLike[], total: number): OrderPaymentSummary {
  const sum = roundMoney(lines.reduce((s, l) => s + Number(l.amount || 0), 0));
  const advanceAmount = roundMoney(Math.min(Math.max(sum, 0), total));
  const paymentStatus =
    advanceAmount <= 0 ? "PENDING" : advanceAmount >= total ? "PAID" : "PARTIAL";
  const nonCash = lines.find((l) => asMethod(l.method) !== "cash");
  const paymentMethod = lines.length === 0 ? "cod" : (nonCash?.method ?? "cash");
  const paymentScreenshotUrls = lines
    .map((l) => l.screenshotUrl)
    .filter((u): u is string => !!u)
    .slice(0, MAX_PAYMENT_SCREENSHOTS);
  const paymentMode: "FULL" | "ADVANCE" =
    total > 0 && advanceAmount >= total ? "FULL" : "ADVANCE";
  return { advanceAmount, paymentStatus, paymentMethod, paymentMode, paymentScreenshotUrls };
}

function assertLineCount(n: number) {
  if (n > MAX_ORDER_PAYMENTS) {
    throw HttpError.badRequest(`At most ${MAX_ORDER_PAYMENTS} payment lines per order`);
  }
}

async function syncOrderFromPayments(tx: Tx, orderId: string, total: number) {
  const lines = await tx.orderPayment.findMany({
    where: { orderId },
    orderBy: { createdAt: "asc" },
  });
  const summary = summarizePayments(lines, total);
  await tx.order.update({
    where: { id: orderId },
    data: {
      advanceAmount: summary.advanceAmount,
      paymentStatus: summary.paymentStatus,
      paymentMethod: summary.paymentMethod,
      paymentMode: summary.paymentMode,
      paymentScreenshotUrls: summary.paymentScreenshotUrls,
    },
  });
  return summary;
}

export async function replaceOrderPayments(
  tx: Tx,
  orderId: string,
  lines: OrderPaymentInput[],
  total: number,
) {
  assertLineCount(lines.length);
  await tx.orderPayment.deleteMany({ where: { orderId } });
  if (lines.length) {
    await tx.orderPayment.createMany({
      data: lines.map((l) => ({
        orderId,
        method: l.method,
        amount: roundMoney(l.amount),
        screenshotUrl: l.screenshotUrl || null,
      })),
    });
  }
  return syncOrderFromPayments(tx, orderId, total);
}

export async function addOrderPayment(
  tx: Tx,
  orderId: string,
  line: OrderPaymentInput,
  total: number,
) {
  const count = await tx.orderPayment.count({ where: { orderId } });
  assertLineCount(count + 1);
  await tx.orderPayment.create({
    data: {
      orderId,
      method: line.method,
      amount: roundMoney(line.amount),
      screenshotUrl: line.screenshotUrl || null,
    },
  });
  return syncOrderFromPayments(tx, orderId, total);
}

export async function removeOrderPayment(tx: Tx, orderId: string, paymentId: string, total: number) {
  const existing = await tx.orderPayment.findFirst({
    where: { id: paymentId, orderId },
    select: { id: true },
  });
  if (!existing) throw HttpError.badRequest("Payment line not found on this order");
  await tx.orderPayment.delete({ where: { id: paymentId } });
  return syncOrderFromPayments(tx, orderId, total);
}

/** Pending-payments drawer / amount-received shortcut: grow or shrink cash so the sum matches. */
export async function adjustCashLineForAdvance(
  tx: Tx,
  orderId: string,
  targetAdvance: number,
  total: number,
) {
  const target = roundMoney(Math.min(Math.max(targetAdvance, 0), total));
  const lines = await tx.orderPayment.findMany({
    where: { orderId },
    orderBy: { createdAt: "asc" },
  });
  const current = roundMoney(lines.reduce((s, l) => s + Number(l.amount), 0));
  const delta = roundMoney(target - current);

  if (delta > 0) {
    const lastCash = [...lines].reverse().find((l) => asMethod(l.method) === "cash");
    if (lastCash) {
      await tx.orderPayment.update({
        where: { id: lastCash.id },
        data: { amount: roundMoney(Number(lastCash.amount) + delta) },
      });
    } else {
      assertLineCount(lines.length + 1);
      await tx.orderPayment.create({
        data: { orderId, method: "cash", amount: delta },
      });
    }
  } else if (delta < 0) {
    let remain = -delta;
    for (let i = lines.length - 1; i >= 0 && remain > 0; i--) {
      const line = lines[i]!;
      const amount = Number(line.amount);
      if (amount <= remain) {
        remain = roundMoney(remain - amount);
        await tx.orderPayment.delete({ where: { id: line.id } });
      } else {
        await tx.orderPayment.update({
          where: { id: line.id },
          data: { amount: roundMoney(amount - remain) },
        });
        remain = 0;
      }
    }
  }

  return syncOrderFromPayments(tx, orderId, total);
}

export function legacyLineFromResolved(opts: {
  advanceAmount: number;
  paymentMethod: string;
  screenshotUrls: string[];
}): OrderPaymentInput[] {
  if (opts.advanceAmount <= 0 && opts.screenshotUrls.length === 0) return [];
  return [
    {
      method: asMethod(opts.paymentMethod === "cod" ? "cash" : opts.paymentMethod),
      amount: opts.advanceAmount > 0 ? opts.advanceAmount : 0.01,
      screenshotUrl: opts.screenshotUrls[0] ?? null,
    },
  ];
}
