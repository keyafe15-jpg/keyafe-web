import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../../utils/httpError.js";
import { quoteCoupon, getPublicFreeDelivery, listPublicCoupons } from "./coupon.service.js";

export const couponRouter = Router();

const previewSchema = z.object({
  code: z.string().trim().min(1),
  customerPhone: z.string().trim().optional().default(""),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        unitPrice: z.number().nonnegative(),
        qty: z.number().int().positive(),
      }),
    )
    .min(1),
  subtotal: z.number().nonnegative().optional(),
});

couponRouter.get("/public", async (_req, res) => {
  const coupons = await listPublicCoupons();
  res.setHeader("Cache-Control", "public, max-age=30");
  res.json(coupons);
});

couponRouter.post("/preview", async (req, res) => {
  const parsed = previewSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid coupon preview", parsed.error.flatten());
  }
  const quote = await quoteCoupon(
    parsed.data.code,
    parsed.data.items,
    parsed.data.customerPhone,
  );
  const subtotal =
    parsed.data.subtotal ??
    parsed.data.items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
  const delivery = await getPublicFreeDelivery(subtotal);
  res.json({
    ...quote,
    freeDelivery:
      quote.waivesDelivery || delivery.active
        ? {
            active: true,
            label: quote.waivesDelivery
              ? "Free delivery with this coupon"
              : delivery.label,
          }
        : delivery,
  });
});

couponRouter.get("/free-delivery", async (req, res) => {
  const subtotal = Number(req.query.subtotal) || 0;
  const state = await getPublicFreeDelivery(subtotal);
  res.setHeader("Cache-Control", "no-store");
  res.json(state);
});
