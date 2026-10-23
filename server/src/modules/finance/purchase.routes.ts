import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";
import type { AuthenticatedRequest } from "../../middleware/auth.js";
import {
  BOOKS_PAY_METHODS,
  BUY_ITEM_UNITS,
  optionalDateKey,
  pageJson,
  pageParams,
  parseDateKey,
  PURCHASE_PURPOSES,
  requireBooksWrite,
  VENDOR_CHANNELS,
} from "./books.shared.js";
import {
  createPurchase,
  getPurchase,
  purchaseListWhere,
  resolveCategory,
  resolveVendor,
  serializePurchase,
  updatePurchase,
  voidPurchase,
} from "./purchase.service.js";

export const adminPurchaseRouter = Router();

const lineSchema = z.object({
  buyItemId: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(120).optional(),
  unit: z.enum(BUY_ITEM_UNITS).optional(),
  packSize: z.coerce.number().int().positive().nullable().optional(),
  qty: z.coerce.number().positive(),
  unitPrice: z.coerce.number().nonnegative(),
  purpose: z.enum(PURCHASE_PURPOSES).optional(),
});

const vendorRefSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(160).optional(),
  phone: z
    .string()
    .trim()
    .max(20)
    .optional()
    .nullable()
    .transform((v) => v || null),
  channel: z.enum(VENDOR_CHANNELS).optional(),
});

const createSchema = z.object({
  date: z.string().trim(),
  vendor: vendorRefSchema,
  purpose: z.enum(PURCHASE_PURPOSES).default("PRODUCTION"),
  paymentMethod: z.enum(BOOKS_PAY_METHODS),
  notes: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .nullable()
    .transform((v) => v || null),
  shipping: z.coerce.number().nonnegative().optional(),
  category: z.string().trim().min(1).default("raw-materials"),
  lines: z.array(lineSchema).min(1),
});

adminPurchaseRouter.get("/", async (req, res) => {
  const { page, pageSize, skip } = pageParams(req.query);
  const vendorId = typeof req.query.vendorId === "string" ? req.query.vendorId : undefined;
  const buyItemId = typeof req.query.buyItemId === "string" ? req.query.buyItemId : undefined;
  const purposeRaw = typeof req.query.purpose === "string" ? req.query.purpose : undefined;
  const purpose = PURCHASE_PURPOSES.includes(purposeRaw as (typeof PURCHASE_PURPOSES)[number])
    ? (purposeRaw as (typeof PURCHASE_PURPOSES)[number])
    : undefined;
  const where = purchaseListWhere({
    vendorId,
    buyItemId,
    purpose,
    from: optionalDateKey(req.query.from),
    to: optionalDateKey(req.query.to),
    includeVoided: req.query.includeVoided === "true",
  });
  const [total, rows] = await Promise.all([
    prisma.purchase.count({ where }),
    prisma.purchase.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip,
      take: pageSize,
      include: {
        vendor: { select: { id: true, name: true, phone: true, channel: true } },
        lines: {
          orderBy: { id: "asc" },
          include: { buyItem: { select: { id: true, name: true, unit: true, packSize: true } } },
        },
        expense: { select: { id: true, categoryId: true } },
      },
    }),
  ]);
  res.json(pageJson(rows.map(serializePurchase), total, page, pageSize));
});

adminPurchaseRouter.get("/:id", async (req, res) => {
  res.json(await getPurchase(req.params.id ?? ""));
});

adminPurchaseRouter.post("/", async (req, res) => {
  const staff = requireBooksWrite(req as AuthenticatedRequest);
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) throw HttpError.badRequest("Invalid buy", parsed.error.flatten());
  const vendorId = await resolveVendor(parsed.data.vendor);
  const category = await resolveCategory(parsed.data.category);
  const created = await createPurchase({
    date: parseDateKey(parsed.data.date),
    vendorId,
    purpose: parsed.data.purpose,
    paymentMethod: parsed.data.paymentMethod,
    notes: parsed.data.notes,
    shipping: parsed.data.shipping,
    categoryId: category.id,
    createdByUserId: staff.id,
    lines: parsed.data.lines,
  });
  res.status(201).json(created);
});

adminPurchaseRouter.patch("/:id", async (req, res) => {
  requireBooksWrite(req as AuthenticatedRequest);
  const parsed = createSchema.partial().safeParse(req.body);
  if (!parsed.success) throw HttpError.badRequest("Invalid buy", parsed.error.flatten());
  const data = parsed.data;
  const vendorId = data.vendor ? await resolveVendor(data.vendor) : undefined;
  const category = data.category ? await resolveCategory(data.category) : undefined;
  res.json(
    await updatePurchase(req.params.id ?? "", {
      date: data.date ? parseDateKey(data.date) : undefined,
      vendorId,
      purpose: data.purpose,
      paymentMethod: data.paymentMethod,
      notes: data.notes,
      shipping: data.shipping,
      categoryId: category?.id,
      lines: data.lines,
    }),
  );
});

adminPurchaseRouter.post("/:id/void", async (req, res) => {
  requireBooksWrite(req as AuthenticatedRequest);
  res.json(await voidPurchase(req.params.id ?? ""));
});
