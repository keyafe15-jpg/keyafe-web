import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";
import { getPublicKey, isPushConfigured } from "../../lib/push.js";

// TODO: gate behind requireAuth once auth is wired.
export const adminPushRouter = Router();

adminPushRouter.get("/vapid-public-key", (_req, res) => {
  const key = getPublicKey();
  if (!key) {
    // 501 — server understands the request but push isn't configured.
    res.status(501).json({ error: "Web Push not configured on server" });
    return;
  }
  res.json({ publicKey: key });
});

adminPushRouter.get("/status", (_req, res) => {
  res.json({ configured: isPushConfigured() });
});

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  label: z.string().trim().max(80).optional().nullable(),
  userAgent: z.string().trim().max(500).optional().nullable(),
});

adminPushRouter.post("/subscribe", async (req, res) => {
  const parsed = subscribeSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid subscription", parsed.error.flatten());
  }
  const { endpoint, keys, label, userAgent } = parsed.data;

  const row = await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: {
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      label: label ?? null,
      userAgent: userAgent ?? null,
    },
    update: {
      p256dh: keys.p256dh,
      auth: keys.auth,
      label: label ?? undefined,
      userAgent: userAgent ?? undefined,
    },
    select: { id: true, createdAt: true },
  });
  res.status(201).json({ id: row.id, createdAt: row.createdAt });
});

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

adminPushRouter.post("/unsubscribe", async (req, res) => {
  const parsed = unsubscribeSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid unsubscribe", parsed.error.flatten());
  }
  await prisma.pushSubscription
    .delete({ where: { endpoint: parsed.data.endpoint } })
    .catch(() => {
      // Already gone — treat as success.
    });
  res.status(204).end();
});
