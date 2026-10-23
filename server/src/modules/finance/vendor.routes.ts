import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/db.js";
import { gstinIssue, normalizeGstin } from "../../lib/gstin.js";
import { HttpError } from "../../utils/httpError.js";
import { VENDOR_CHANNELS } from "./books.shared.js";

export const adminVendorRouter = Router();

const suppliesSchema = z.array(z.string().trim().min(1).max(40)).max(20);

const vendorBodySchema = z.object({
  name: z.string().trim().min(1).max(160),
  channel: z.enum(VENDOR_CHANNELS).optional(),
  phone: z
    .string()
    .trim()
    .max(20)
    .optional()
    .nullable()
    .transform((v) => v || null),
  supplies: suppliesSchema.optional(),
  gstin: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v ? normalizeGstin(v) : null))
    .refine((v) => v === null || gstinIssue(v) === null, {
      message: "Enter a valid 15-character GSTIN",
    }),
  address: z
    .string()
    .trim()
    .max(400)
    .optional()
    .nullable()
    .transform((v) => v || null),
  notes: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .nullable()
    .transform((v) => v || null),
  upiId: z
    .string()
    .trim()
    .max(120)
    .optional()
    .nullable()
    .transform((v) => v || null),
  accountHint: z
    .string()
    .trim()
    .max(160)
    .optional()
    .nullable()
    .transform((v) => v || null),
  isActive: z.boolean().optional(),
});

const vendorSelect = {
  id: true,
  name: true,
  phone: true,
  channel: true,
  supplies: true,
  gstin: true,
  address: true,
  notes: true,
  upiId: true,
  accountHint: true,
  isActive: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

adminVendorRouter.get("/", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const activeRaw = typeof req.query.active === "string" ? req.query.active : "ACTIVE";
  const channelRaw = typeof req.query.channel === "string" ? req.query.channel : "ALL";
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
  const where: {
    isActive?: boolean;
    channel?: "OFFLINE" | "ONLINE";
    OR?: {
      name?: { contains: string; mode: "insensitive" };
      phone?: { contains: string };
      address?: { contains: string; mode: "insensitive" };
    }[];
  } = {};
  if (activeRaw === "ACTIVE") where.isActive = true;
  else if (activeRaw === "ARCHIVED") where.isActive = false;
  if (channelRaw === "OFFLINE" || channelRaw === "ONLINE") where.channel = channelRaw;
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
      { address: { contains: q, mode: "insensitive" } },
      { notes: { contains: q, mode: "insensitive" } },
      { gstin: { contains: q, mode: "insensitive" } },
      { supplies: { has: q.toLowerCase() } },
    ];
  }
  const [total, items] = await Promise.all([
    prisma.vendor.count({ where }),
    prisma.vendor.findMany({
      where,
      orderBy: [{ name: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: vendorSelect,
    }),
  ]);
  res.json({
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
});

adminVendorRouter.get("/:id", async (req, res) => {
  const id = req.params.id ?? "";
  const vendor = await prisma.vendor.findUnique({ where: { id }, select: vendorSelect });
  if (!vendor) throw HttpError.notFound("Vendor not found");
  res.json(vendor);
});

adminVendorRouter.post("/", async (req, res) => {
  const parsed = vendorBodySchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid vendor", parsed.error.flatten());
  }
  const { isActive, ...rest } = parsed.data;
  const created = await prisma.vendor.create({
    data: {
      ...rest,
      supplies: rest.supplies ?? [],
      isActive: isActive ?? true,
      archivedAt: isActive === false ? new Date() : null,
    },
    select: vendorSelect,
  });
  res.status(201).json(created);
});

adminVendorRouter.patch("/:id", async (req, res) => {
  const id = req.params.id ?? "";
  const parsed = vendorBodySchema.partial().safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid vendor", parsed.error.flatten());
  }
  const existing = await prisma.vendor.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw HttpError.notFound("Vendor not found");

  const { isActive, ...rest } = parsed.data;
  const data: typeof rest & { isActive?: boolean; archivedAt?: Date | null } = { ...rest };
  if (isActive !== undefined) {
    data.isActive = isActive;
    data.archivedAt = isActive ? null : new Date();
  }

  const updated = await prisma.vendor.update({
    where: { id },
    data,
    select: vendorSelect,
  });
  res.json(updated);
});
