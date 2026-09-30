import { Router, type Request } from "express";
import { z } from "zod";
import { requirePermission } from "../../middleware/auth.js";
import { HttpError } from "../../utils/httpError.js";
import { logger } from "../../utils/logger.js";
import { verifyCfWebhookSignature } from "./cashfree.client.js";
import {
  createPaymentSession,
  paymentConfig,
  reconcileByGatewayOrderId,
  reconcileByOrderNumber,
  reconcilePayment,
  switchToCashOnDelivery,
} from "./payment.service.js";

export type RawBodyRequest = Request & { rawBody?: Buffer };

const orderNumberBody = z.object({ orderNumber: z.string().trim().min(3).max(40) });

function parseOrderNumber(body: unknown) {
  const parsed = orderNumberBody.safeParse(body);
  if (!parsed.success) throw HttpError.badRequest("Order number is required");
  return parsed.data.orderNumber;
}

export const paymentRouter = Router();

paymentRouter.get("/config", (_req, res) => {
  res.json(paymentConfig());
});

// Public and keyed by order number, like GET /orders/:number — the amount is
// always recomputed server-side, so knowing the number only lets you pay it.
paymentRouter.post("/cashfree/session", async (req, res) => {
  res.json(await createPaymentSession(parseOrderNumber(req.body)));
});

paymentRouter.post("/cashfree/verify", async (req, res) => {
  const state = await reconcileByOrderNumber(parseOrderNumber(req.body));
  res.json({ state });
});

paymentRouter.post("/cashfree/switch-to-cod", async (req, res) => {
  await switchToCashOnDelivery(parseOrderNumber(req.body));
  res.json({ ok: true });
});

paymentRouter.post("/cashfree/webhook", async (req, res) => {
  const raw = (req as RawBodyRequest).rawBody;
  const ok =
    raw &&
    verifyCfWebhookSignature(
      raw,
      req.header("x-webhook-timestamp"),
      req.header("x-webhook-signature"),
    );
  if (!ok) {
    logger.warn({ type: req.body?.type }, "cashfree webhook with bad signature");
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  const gatewayOrderId: unknown = req.body?.data?.order?.order_id;
  logger.info({ type: req.body?.type, gatewayOrderId }, "cashfree webhook");
  if (typeof gatewayOrderId === "string") {
    // The payload is only a nudge — reconcile re-reads the truth from Cashfree.
    await reconcileByGatewayOrderId(gatewayOrderId);
  }
  res.json({ ok: true });
});

export const adminPaymentRouter = Router();

adminPaymentRouter.post(
  "/orders/:orderId/refresh",
  requirePermission("orders.update"),
  async (req, res) => {
    const state = await reconcilePayment(req.params.orderId ?? "");
    res.json({ state });
  },
);
