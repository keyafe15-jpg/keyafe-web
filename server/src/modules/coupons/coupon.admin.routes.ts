import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { HttpError } from "../../utils/httpError.js";
import {
  emailCoupon,
  emailCouponSchema,
  getAdminFreeDelivery,
  listCoupons,
  setCouponActive,
  updateFreeDelivery,
  updateFreeDeliverySchema,
  upsertCoupon,
  upsertCouponSchema,
} from "./coupon.service.js";

export const adminCouponRouter = Router();

adminCouponRouter.get("/", async (_req, res) => {
  res.json(await listCoupons());
});

adminCouponRouter.get("/free-delivery", async (_req, res) => {
  res.json(await getAdminFreeDelivery());
});

adminCouponRouter.patch("/free-delivery", async (req, res) => {
  const parsed = updateFreeDeliverySchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid free delivery", parsed.error.flatten());
  }
  res.json(await updateFreeDelivery(parsed.data));
});

adminCouponRouter.post("/", async (req, res) => {
  const parsed = upsertCouponSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid coupon", parsed.error.flatten());
  }
  const coupon = await upsertCoupon(parsed.data);
  res.status(StatusCodes.OK).json(coupon);
});

adminCouponRouter.patch("/:code/active", async (req, res) => {
  const isActive = Boolean(req.body?.isActive);
  const coupon = await setCouponActive(req.params.code, isActive);
  res.json(coupon);
});

adminCouponRouter.post("/:code/email", async (req, res) => {
  const parsed = emailCouponSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Enter a valid email", parsed.error.flatten());
  }
  res.json(await emailCoupon(req.params.code, parsed.data.to));
});
