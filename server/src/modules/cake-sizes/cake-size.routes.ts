import { Router } from "express";
import { z } from "zod";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";

export const cakeSizeRouter = Router();

cakeSizeRouter.get("/", async (_req, res) => {
  const sizes = await prisma.cakeSize.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { grams: "asc" }],
    select: {
      id: true,
      grams: true,
      label: true,
      servesText: true,
      sortOrder: true,
    },
  });
  res.setHeader("Cache-Control", "public, max-age=60");
  res.json(sizes);
});

// TODO: gate behind requireAuth + requirePermission("cake-sizes.write") once auth is wired.
export const adminCakeSizeRouter = Router();

adminCakeSizeRouter.get("/", async (_req, res) => {
  const sizes = await prisma.cakeSize.findMany({
    orderBy: [{ sortOrder: "asc" }, { grams: "asc" }],
  });
  res.json(sizes);
});

const upsertSchema = z.object({
  grams: z.coerce.number().int().positive(),
  label: z.string().trim().min(1),
  servesText: z.string().trim().nullable().optional(),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
});

adminCakeSizeRouter.post("/", async (req, res) => {
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid cake size", parsed.error.flatten());
  }
  const existing = await prisma.cakeSize.findUnique({
    where: { grams: parsed.data.grams },
    select: { id: true },
  });
  if (existing)
    throw HttpError.conflict("A cake size with that gram value already exists");
  const created = await prisma.cakeSize.create({ data: parsed.data });
  res.status(StatusCodes.CREATED).json(created);
});

adminCakeSizeRouter.patch("/:id", async (req, res) => {
  const parsed = upsertSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest(
      "Invalid cake size update",
      parsed.error.flatten(),
    );
  }
  const updated = await prisma.cakeSize.update({
    where: { id: req.params.id },
    data: parsed.data,
  });
  res.json(updated);
});

adminCakeSizeRouter.delete("/:id", async (req, res) => {
  await prisma.cakeSize.delete({ where: { id: req.params.id } });
  res.status(StatusCodes.NO_CONTENT).end();
});
