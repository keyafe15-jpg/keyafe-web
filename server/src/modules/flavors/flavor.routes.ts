import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";

export const flavorRouter = Router();

flavorRouter.get("/", async (_req, res) => {
  const flavors = await prisma.flavor.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      isEggless: true,
      isSugarFree: true,
      isHealthy: true,
      imageUrl: true,
      additionalAmount: true,
      sortOrder: true,
    },
  });
  res.setHeader("Cache-Control", "public, max-age=60");
  res.json(flavors);
});

// TODO: gate behind requireAuth + requirePermission("flavours.write") once auth is wired.
export const adminFlavorRouter = Router();

adminFlavorRouter.get("/", async (_req, res) => {
  const flavors = await prisma.flavor.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      isEggless: true,
      isSugarFree: true,
      isHealthy: true,
      additionalAmount: true,
      sortOrder: true,
      isActive: true,
    },
  });
  res.json(flavors);
});

const updateFlavorSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().nullable().optional(),
  isEggless: z.boolean().optional(),
  isSugarFree: z.boolean().optional(),
  isHealthy: z.boolean().optional(),
  additionalAmount: z.coerce.number().min(0).optional(),
  sortOrder: z.coerce.number().int().optional(),
  isActive: z.boolean().optional(),
});

adminFlavorRouter.patch("/:id", async (req, res) => {
  const parsed = updateFlavorSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest(
      "Invalid flavour update",
      parsed.error.flatten(),
    );
  }
  const updated = await prisma.flavor.update({
    where: { id: req.params.id },
    data: parsed.data,
    select: {
      id: true,
      slug: true,
      name: true,
      additionalAmount: true,
      isEggless: true,
      isSugarFree: true,
      isHealthy: true,
      sortOrder: true,
      isActive: true,
    },
  });
  res.json(updated);
});
