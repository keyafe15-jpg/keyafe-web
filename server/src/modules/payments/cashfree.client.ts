import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../../config/env.js";
import { HttpError } from "../../utils/httpError.js";
import { logger } from "../../utils/logger.js";

const API_VERSION = "2023-08-01";

const BASE_URL =
  env.CASHFREE_ENV === "production"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";

export const cashfreeMode = env.CASHFREE_ENV;

export function cashfreeEnabled() {
  return Boolean(env.CASHFREE_APP_ID && env.CASHFREE_SECRET_KEY);
}

export type CfOrderStatus = "ACTIVE" | "PAID" | "EXPIRED" | "TERMINATED" | "TERMINATION_REQUESTED";

export interface CfOrder {
  cf_order_id: string | number;
  order_id: string;
  order_amount: number;
  order_status: CfOrderStatus;
  payment_session_id: string;
  order_expiry_time?: string;
}

export type CfPaymentStatus =
  "SUCCESS" | "NOT_ATTEMPTED" | "FAILED" | "USER_DROPPED" | "VOID" | "CANCELLED" | "PENDING";

export interface CfPayment {
  cf_payment_id: string | number;
  order_id: string;
  payment_amount: number;
  payment_status: CfPaymentStatus;
  payment_group?: string;
  payment_message?: string;
  payment_time?: string;
}

async function cfRequest<T>(
  method: "GET" | "POST" | "PATCH",
  path: string,
  body?: unknown,
): Promise<T> {
  if (!cashfreeEnabled()) {
    throw HttpError.serviceUnavailable("Online payment is not available right now");
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-api-version": API_VERSION,
      "x-client-id": env.CASHFREE_APP_ID!,
      "x-client-secret": env.CASHFREE_SECRET_KEY!,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  const text = await res.text();
  const json = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const message = (json as { message?: string } | null)?.message ?? res.statusText;
    logger.error({ status: res.status, path, message }, "cashfree request failed");
    throw new HttpError(
      res.status >= 500 ? 502 : 400,
      `Payment gateway error: ${message}`,
      json ?? undefined,
    );
  }
  return json as T;
}

export interface CreateCfOrderInput {
  gatewayOrderId: string;
  amount: number;
  customer: { id: string; name: string; phone: string; email?: string | null };
  returnUrl: string;
  notifyUrl?: string;
  note?: string;
}

export function createCfOrder(input: CreateCfOrderInput) {
  return cfRequest<CfOrder>("POST", "/orders", {
    order_id: input.gatewayOrderId,
    order_amount: input.amount,
    order_currency: "INR",
    customer_details: {
      customer_id: input.customer.id,
      customer_name: input.customer.name,
      customer_phone: input.customer.phone,
      ...(input.customer.email ? { customer_email: input.customer.email } : {}),
    },
    order_meta: {
      return_url: input.returnUrl,
      ...(input.notifyUrl ? { notify_url: input.notifyUrl } : {}),
    },
    ...(input.note ? { order_note: input.note } : {}),
  });
}

export function getCfOrder(gatewayOrderId: string) {
  return cfRequest<CfOrder>("GET", `/orders/${encodeURIComponent(gatewayOrderId)}`);
}

export function getCfPayments(gatewayOrderId: string) {
  return cfRequest<CfPayment[]>("GET", `/orders/${encodeURIComponent(gatewayOrderId)}/payments`);
}

/** Stops further payments on a gateway order (e.g. customer switched to COD). */
export function terminateCfOrder(gatewayOrderId: string) {
  return cfRequest<CfOrder>("PATCH", `/orders/${encodeURIComponent(gatewayOrderId)}`, {
    order_status: "TERMINATED",
  });
}

export type CfRefundStatus = "PENDING" | "SUCCESS" | "CANCELLED" | "ONHOLD";

export interface CfRefund {
  cf_refund_id?: string | number;
  refund_id: string;
  order_id: string;
  refund_amount: number;
  refund_status: CfRefundStatus;
  status_description?: string;
}

/** Sends `amount` back against the successful payment on a gateway order. */
export function createCfRefund(input: {
  gatewayOrderId: string;
  refundId: string;
  amount: number;
  note?: string;
}) {
  return cfRequest<CfRefund>(
    "POST",
    `/orders/${encodeURIComponent(input.gatewayOrderId)}/refunds`,
    {
      refund_amount: input.amount,
      refund_id: input.refundId,
      // Cashfree accepts 3–100 characters.
      ...(input.note && input.note.length >= 3 ? { refund_note: input.note.slice(0, 100) } : {}),
    },
  );
}

export function getCfRefund(gatewayOrderId: string, refundId: string) {
  return cfRequest<CfRefund>(
    "GET",
    `/orders/${encodeURIComponent(gatewayOrderId)}/refunds/${encodeURIComponent(refundId)}`,
  );
}

/** base64(HMAC-SHA256(timestamp + rawBody, secret)) — Cashfree's webhook signature. */
export function verifyCfWebhookSignature(
  rawBody: Buffer | string,
  timestamp: string | undefined,
  signature: string | undefined,
) {
  if (!env.CASHFREE_SECRET_KEY || !timestamp || !signature) return false;
  const expected = createHmac("sha256", env.CASHFREE_SECRET_KEY)
    .update(timestamp + (typeof rawBody === "string" ? rawBody : rawBody.toString("utf8")))
    .digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
