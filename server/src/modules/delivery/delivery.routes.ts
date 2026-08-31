import { Router } from "express";
import { z } from "zod";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";
import { checkPincode } from "./delivery.service.js";

export const deliveryRouter = Router();
export const adminDeliveryRouter = Router();

const PINCODE_RE = /^[1-9][0-9]{5}$/;

deliveryRouter.get("/check-pincode/:pincode", async (req, res) => {
  const pincode = req.params.pincode;
  if (!PINCODE_RE.test(pincode)) {
    throw HttpError.badRequest("Enter a valid 6-digit pincode");
  }
  const result = await checkPincode(pincode);
  res.setHeader("Cache-Control", "public, max-age=300");
  res.json(result);
});

const deliveryPincodeSchema = z.object({
  pincode: z.string().trim().regex(PINCODE_RE, "Enter a valid 6-digit pincode"),
  city: z.string().trim().min(2),
  area: z.string().trim().nullable().optional(),
  district: z.enum(["KOLKATA", "HOWRAH", "HOOGHLY"]),
  deliveryFee: z.coerce.number().min(0),
  sameDayEligible: z.boolean().default(true),
  minOrderAmount: z.coerce.number().min(0).nullable().optional(),
  extraLeadHours: z.coerce.number().int().min(0).default(0),
  notes: z.string().trim().nullable().optional(),
  isActive: z.boolean().default(true),
  expressEligible: z.boolean().default(true),
  expressDeliveryFee: z.coerce.number().min(0).nullable().optional(),
});

adminDeliveryRouter.get("/pincodes", async (_req, res) => {
  const rows = await prisma.deliveryPincode.findMany({
    orderBy: [{ district: "asc" }, { city: "asc" }, { area: "asc" }],
  });
  res.json(rows);
});

adminDeliveryRouter.post("/pincodes", async (req, res) => {
  const parsed = deliveryPincodeSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest(
      "Invalid delivery pincode",
      parsed.error.flatten(),
    );
  }

  const created = await prisma.deliveryPincode.create({
    data: {
      ...parsed.data,
      area: parsed.data.area || null,
      minOrderAmount: parsed.data.minOrderAmount ?? null,
      notes: parsed.data.notes || null,
      expressDeliveryFee: parsed.data.expressDeliveryFee ?? null,
    },
  });
  res.status(StatusCodes.CREATED).json(created);
});

adminDeliveryRouter.post("/pincodes/bulk", async (req, res) => {
  const parsed = z
    .object({ rows: z.array(deliveryPincodeSchema).min(1).max(1000) })
    .safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest(
      "Invalid delivery pincode import",
      parsed.error.flatten(),
    );
  }

  const byPincode = new Map(
    parsed.data.rows.map((row) => [
      row.pincode,
      {
        city: row.city,
        area: row.area || null,
        district: row.district,
        deliveryFee: row.deliveryFee,
        sameDayEligible: row.sameDayEligible,
        minOrderAmount: row.minOrderAmount ?? null,
        extraLeadHours: row.extraLeadHours,
        notes: row.notes || null,
        isActive: row.isActive,
        expressEligible: row.expressEligible,
        expressDeliveryFee: row.expressDeliveryFee ?? null,
      },
    ]),
  );

  const rows = [...byPincode.entries()];
  await prisma.$transaction(
    rows.map(([pincode, data]) =>
      prisma.deliveryPincode.upsert({
        where: { pincode },
        create: { pincode, ...data },
        update: data,
      }),
    ),
  );

  res.json({
    imported: rows.length,
    skippedDuplicates: parsed.data.rows.length - rows.length,
  });
});

const updateDeliveryPincodeSchema = deliveryPincodeSchema
  .omit({ pincode: true })
  .partial();

adminDeliveryRouter.patch("/pincodes/:pincode", async (req, res) => {
  if (!PINCODE_RE.test(req.params.pincode)) {
    throw HttpError.badRequest("Enter a valid 6-digit pincode");
  }

  const parsed = updateDeliveryPincodeSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest(
      "Invalid delivery pincode update",
      parsed.error.flatten(),
    );
  }

  const updated = await prisma.deliveryPincode.update({
    where: { pincode: req.params.pincode },
    data: parsed.data,
  });
  res.json(updated);
});

adminDeliveryRouter.delete("/pincodes/:pincode", async (req, res) => {
  if (!PINCODE_RE.test(req.params.pincode)) {
    throw HttpError.badRequest("Enter a valid 6-digit pincode");
  }
  await prisma.deliveryPincode.delete({
    where: { pincode: req.params.pincode },
  });
  res.json({ ok: true });
});
