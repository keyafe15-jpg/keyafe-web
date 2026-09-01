import webpush from "web-push";
import { env } from "../config/env.js";
import { prisma } from "../config/db.js";
import { logger } from "../utils/logger.js";
import type { NewOrderEvent, OrderCancelledEvent } from "./events.js";
import { orderEvents } from "./events.js";

const publicKey = env.VAPID_PUBLIC_KEY;
const privateKey = env.VAPID_PRIVATE_KEY;
const configured = Boolean(publicKey && privateKey);

if (configured) {
  webpush.setVapidDetails(env.VAPID_SUBJECT, publicKey!, privateKey!);
} else {
  logger.warn("VAPID keys missing — Web Push disabled (sendPushToAll no-ops).");
}

export function isPushConfigured(): boolean {
  return configured;
}

export function getPublicKey(): string | null {
  return publicKey ?? null;
}

// Delivers `payload` to every stored subscription. Expired (410/404) subs are
// pruned from the DB so we don't retry forever.
export async function sendPushToAll(payload: unknown): Promise<void> {
  if (!configured) return;

  const subs = await prisma.pushSubscription.findMany({
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  if (subs.length === 0) return;

  const body = JSON.stringify(payload);
  const stale: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          body,
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          stale.push(s.id);
        } else {
          logger.warn(
            { err, subId: s.id, statusCode },
            "push delivery failed (will retry next event)",
          );
        }
      }
    }),
  );

  if (stale.length) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: stale } } });
    logger.info({ removed: stale.length }, "pruned stale push subscriptions");
  }

  // Best-effort touch — some rows may already have been pruned above.
  await prisma.pushSubscription
    .updateMany({
      where: {
        id: { in: subs.map((s) => s.id).filter((id) => !stale.includes(id)) },
      },
      data: { lastPushAt: new Date() },
    })
    .catch(() => {
      // ignore; not critical
    });
}

// Subscribe to the in-process order bus and forward each event to Web Push.
// Called once at boot.
export function attachPushToOrderEvents() {
  orderEvents.on("new-order", (ev: NewOrderEvent) => {
    void sendPushToAll({
      title: `New order · ${ev.orderNumber}`,
      body: `${ev.customerName} · ₹${Number(ev.total).toFixed(0)} · ${ev.itemCount} item${ev.itemCount === 1 ? "" : "s"}`,
      orderNumber: ev.orderNumber,
      source: ev.source,
    }).catch((err) => {
      logger.error({ err }, "push fan-out failed");
    });
  });

  orderEvents.on("order-cancelled", (ev: OrderCancelledEvent) => {
    const who = ev.cancelledBy === "customer" ? "Customer" : "Admin";
    void sendPushToAll({
      title: `Order cancelled · ${ev.orderNumber}`,
      body: `${who} cancelled ${ev.customerName} · ₹${Number(ev.total).toFixed(0)}`,
      orderNumber: ev.orderNumber,
      type: "order-cancelled",
    }).catch((err) => {
      logger.error({ err }, "cancel push fan-out failed");
    });
  });
}
