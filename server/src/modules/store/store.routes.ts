import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";
import { computeSameDayStatus, getStoreHours, updateStoreHours, updateStoreHoursSchema } from "./store.service.js";

export const storeRouter = Router();
export const adminBusinessRouter = Router();
export const adminStoreRouter = Router();

storeRouter.get("/same-day-status", async (_req, res) => {
  const status = await computeSameDayStatus();
  res.setHeader("Cache-Control", "no-store");
  res.json(status);
});

storeRouter.get("/same-day-categories", async (_req, res) => {
  const categories = await prisma.sameDayCategory.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      imageUrl: true,
      sortOrder: true,
    },
  });
  res.setHeader("Cache-Control", "public, max-age=60");
  res.json(categories);
});

// Safe-to-expose UPI collection details for manual-payment flows (order
// links, offline orders). Null upiId means UPI collection isn't set up yet.
storeRouter.get("/payment-info", async (_req, res) => {
  const settings = await prisma.businessSettings.findFirst({
    select: { upiId: true, upiPayeeName: true, tradeName: true },
  });
  res.setHeader("Cache-Control", "public, max-age=60");
  res.json({
    upiId: settings?.upiId ?? null,
    payeeName: settings?.upiPayeeName || settings?.tradeName || "Keyafe",
  });
});

// TODO: gate behind requireAuth + requirePermission("settings.update") once auth lands.
const businessUpiSchema = z.object({
  upiId: z.string().trim().min(3).nullable(),
  upiPayeeName: z.string().trim().min(2).nullable().optional(),
});

adminBusinessRouter.get("/upi", async (_req, res) => {
  const settings = await prisma.businessSettings.findFirst({
    select: { upiId: true, upiPayeeName: true },
  });
  res.json({
    upiId: settings?.upiId ?? null,
    upiPayeeName: settings?.upiPayeeName ?? null,
  });
});

adminBusinessRouter.patch("/upi", async (req, res) => {
  const parsed = businessUpiSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid input", parsed.error.flatten());
  }
  const existing = await prisma.businessSettings.findFirst({
    select: { id: true },
  });
  if (!existing) throw HttpError.notFound("Business settings not found");
  const updated = await prisma.businessSettings.update({
    where: { id: existing.id },
    data: parsed.data,
    select: { upiId: true, upiPayeeName: true },
  });
  res.json(updated);
});

// TODO: gate behind requireAuth + requirePermission("store.update") once auth lands.
adminStoreRouter.get("/hours", async (_req, res) => {
  const hours = await getStoreHours();
  res.json(hours);
});

adminStoreRouter.patch("/hours", async (req, res) => {
  const parsed = updateStoreHoursSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid store hours", parsed.error.flatten());
  }
  const hours = await updateStoreHours(parsed.data);
  res.json(hours);
});
