import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";
import { gstinIssue, gstinStateCode, normalizeGstin } from "../../lib/gstin.js";
import { FALLBACK_SELLER_STATE_CODE } from "../orders/order.tax.js";
import {
  computeSameDayStatus,
  getStoreHours,
  updateStoreHours,
  updateStoreHoursSchema,
  listUpcomingClosures,
  createShopClosure,
  createClosureSchema,
  deleteShopClosure,
} from "./store.service.js";

export const storeRouter = Router();
export const adminBusinessRouter = Router();
export const adminStoreRouter = Router();

storeRouter.get("/same-day-status", async (_req, res) => {
  const status = await computeSameDayStatus();
  res.setHeader("Cache-Control", "no-store");
  res.json(status);
});

storeRouter.get("/closures", async (_req, res) => {
  const closures = await listUpcomingClosures();
  res.setHeader("Cache-Control", "public, max-age=30");
  res.json(closures);
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

storeRouter.get("/announcement", async (_req, res) => {
  const settings = await prisma.businessSettings.findFirst({
    select: {
      announcementEnabled: true,
      announcementText: true,
      announcementLinkUrl: true,
      announcementLinkLabel: true,
    },
  });
  const text = settings?.announcementText.trim() ?? "";
  res.setHeader("Cache-Control", "public, max-age=15");
  if (!settings?.announcementEnabled || !text) {
    res.json(null);
    return;
  }
  res.json({
    text,
    linkUrl: settings.announcementLinkUrl,
    linkLabel: settings.announcementLinkLabel,
  });
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

// adminBusinessRouter is mounted in app.ts behind requireStaff +
// requirePermission("settings.update"), so handlers here assume staff access.
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

// Seller identity printed on every tax invoice. Deliberately not seeded — it
// is entered here once, and `registeredAddress.stateCode` is what decides
// CGST+SGST versus IGST on every order.
const gstSelect = {
  legalName: true,
  tradeName: true,
  gstin: true,
  gstScheme: true,
  registeredAddress: true,
  invoicePrefix: true,
  fyStartMonth: true,
  challanTerms: true,
} as const;

// Every field here prints on the invoice, so the whole address is required
// once the seller saves it — the admin form enforces the same.
const registeredAddressSchema = z.object({
  line1: z.string().trim().min(1, "Required").max(200),
  line2: z.string().trim().max(200).optional().default(""),
  city: z.string().trim().min(1, "Required").max(100),
  state: z.string().trim().min(1, "Required").max(100),
  stateCode: z
    .string()
    .trim()
    .regex(/^\d{2}$/, "Two-digit GST state code"),
  pincode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Six-digit pincode"),
});

const businessGstSchema = z.object({
  legalName: z.string().trim().min(2).max(160),
  tradeName: z.string().trim().min(2).max(160),
  // Null is allowed: an unregistered seller issues a plain invoice, not a
  // tax invoice. A present value must be a real GSTIN.
  gstin: z
    .string()
    .trim()
    .transform((v) => (v ? normalizeGstin(v) : null))
    .nullable()
    .refine((v) => v === null || gstinIssue(v) === null, {
      message: "Enter a valid 15-character GSTIN",
    }),
  gstScheme: z.enum(["REGULAR", "COMPOSITE"]),
  registeredAddress: registeredAddressSchema,
  invoicePrefix: z
    .string()
    .trim()
    .min(1)
    .max(10)
    .regex(/^[A-Za-z0-9]+$/, "Letters and numbers only")
    .transform((v) => v.toUpperCase()),
  fyStartMonth: z.coerce.number().int().min(1).max(12),
  // Free text printed in the terms box on delivery challans. Blank collapses
  // to null so the box is omitted rather than printed empty.
  challanTerms: z
    .string()
    .trim()
    .max(600)
    .optional()
    .nullable()
    .transform((v) => v || null),
});

const EMPTY_REGISTERED_ADDRESS = {
  line1: "",
  line2: "",
  city: "",
  state: "",
  stateCode: FALLBACK_SELLER_STATE_CODE,
  pincode: "",
};

adminBusinessRouter.get("/gst", async (_req, res) => {
  const settings = await prisma.businessSettings.findFirst({
    select: gstSelect,
  });
  if (!settings) throw HttpError.notFound("Business settings not found");
  // registeredAddress is a Json column that starts out unset. Always hand the
  // admin form a complete object so it has something to bind its inputs to.
  const stored =
    settings.registeredAddress && typeof settings.registeredAddress === "object"
      ? (settings.registeredAddress as Record<string, unknown>)
      : {};
  res.json({
    ...settings,
    registeredAddress: { ...EMPTY_REGISTERED_ADDRESS, ...stored },
  });
});

adminBusinessRouter.patch("/gst", async (req, res) => {
  const parsed = businessGstSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid input", parsed.error.flatten());
  }

  // A GSTIN starts with the state code of the state it was issued in. If that
  // disagrees with the registered address, one of the two is a typo and every
  // invoice would carry the error.
  const { gstin, registeredAddress } = parsed.data;
  if (gstin) {
    const gstinState = gstinStateCode(gstin);
    if (gstinState && gstinState !== registeredAddress.stateCode) {
      throw HttpError.badRequest(
        `GSTIN begins with state code ${gstinState} but the registered address says ${registeredAddress.stateCode}. Please correct whichever is wrong.`,
      );
    }
  }

  const existing = await prisma.businessSettings.findFirst({
    select: { id: true },
  });
  if (!existing) throw HttpError.notFound("Business settings not found");

  const updated = await prisma.businessSettings.update({
    where: { id: existing.id },
    data: parsed.data,
    select: gstSelect,
  });
  res.json(updated);
});

const announcementSelect = {
  announcementEnabled: true,
  announcementText: true,
  announcementLinkUrl: true,
  announcementLinkLabel: true,
} as const;

function sanitizeAnnouncementLink(raw: string | null | undefined): string | null {
  const value = raw?.trim() || null;
  if (!value) return null;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString();
    }
  } catch {
    // fall through
  }
  throw HttpError.badRequest("Link must be a site path like /pan-india or a https URL.");
}

const announcementSchema = z.object({
  announcementEnabled: z.boolean(),
  announcementText: z.string().trim().max(160),
  announcementLinkUrl: z.string().trim().max(300).nullable().optional(),
  announcementLinkLabel: z.string().trim().max(40).nullable().optional(),
});

adminBusinessRouter.get("/announcement", async (_req, res) => {
  const settings = await prisma.businessSettings.findFirst({
    select: announcementSelect,
  });
  res.json({
    announcementEnabled: settings?.announcementEnabled ?? false,
    announcementText: settings?.announcementText ?? "",
    announcementLinkUrl: settings?.announcementLinkUrl ?? null,
    announcementLinkLabel: settings?.announcementLinkLabel ?? null,
  });
});

adminBusinessRouter.patch("/announcement", async (req, res) => {
  const parsed = announcementSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid announcement", parsed.error.flatten());
  }
  const existing = await prisma.businessSettings.findFirst({
    select: { id: true },
  });
  if (!existing) throw HttpError.notFound("Business settings not found");
  const linkUrl = sanitizeAnnouncementLink(parsed.data.announcementLinkUrl);
  const label = parsed.data.announcementLinkLabel?.trim() || null;
  const updated = await prisma.businessSettings.update({
    where: { id: existing.id },
    data: {
      announcementEnabled: parsed.data.announcementEnabled,
      announcementText: parsed.data.announcementText,
      announcementLinkUrl: linkUrl,
      announcementLinkLabel: linkUrl ? label : null,
    },
    select: announcementSelect,
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

adminStoreRouter.post("/closures", async (req, res) => {
  const parsed = createClosureSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid closure", parsed.error.flatten());
  }
  const closure = await createShopClosure(parsed.data);
  res.status(201).json(closure);
});

adminStoreRouter.delete("/closures/:id", async (req, res) => {
  await deleteShopClosure(req.params.id);
  res.json({ ok: true });
});
