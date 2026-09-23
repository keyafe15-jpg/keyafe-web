import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { Prisma } from "@prisma/client";
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

const flavorSelect = {
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
  _count: { select: { products: true } },
} as const;

function withProductCount<T extends { _count: { products: number } }>(row: T) {
  const { _count, ...rest } = row;
  return { ...rest, productCount: _count.products };
}

function slugifyFlavour(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

adminFlavorRouter.get("/", async (_req, res) => {
  const flavors = await prisma.flavor.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: flavorSelect,
  });
  res.json(flavors.map(withProductCount));
});

const createFlavorSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, digits and hyphens only")
    .optional(),
  description: z.string().trim().nullable().optional(),
  isEggless: z.boolean().default(false),
  isSugarFree: z.boolean().default(false),
  isHealthy: z.boolean().default(false),
  additionalAmount: z.coerce.number().min(0).default(0),
  sortOrder: z.coerce.number().int().optional(),
  isActive: z.boolean().default(true),
});

adminFlavorRouter.post("/", async (req, res) => {
  const parsed = createFlavorSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid flavour data", parsed.error.flatten());
  }

  const { name, description, isEggless, isSugarFree, isHealthy, additionalAmount, isActive } =
    parsed.data;
  const slug = (parsed.data.slug?.trim() || slugifyFlavour(name)) || "flavour";
  const sortOrder = parsed.data.sortOrder ?? ((await prisma.flavor.count()) + 1) * 10;

  try {
    const created = await prisma.flavor.create({
      data: {
        name,
        slug,
        description: description ?? null,
        isEggless,
        isSugarFree,
        isHealthy,
        additionalAmount,
        sortOrder,
        isActive,
      },
      select: flavorSelect,
    });
    res.status(StatusCodes.CREATED).json(withProductCount(created));
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw HttpError.conflict("A flavour with this slug already exists");
    }
    throw err;
  }
});

const reorderFlavorSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});

adminFlavorRouter.post("/reorder", async (req, res) => {
  const parsed = reorderFlavorSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid reorder payload", parsed.error.flatten());
  }
  const { orderedIds } = parsed.data;
  const unique = [...new Set(orderedIds)];
  if (unique.length !== orderedIds.length) {
    throw HttpError.badRequest("Duplicate ids in reorder list");
  }

  const existing = await prisma.flavor.findMany({
    where: { id: { in: orderedIds } },
    select: { id: true },
  });
  if (existing.length !== orderedIds.length) {
    throw HttpError.badRequest("One or more flavours were not found");
  }

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.flavor.update({
        where: { id },
        data: { sortOrder: (index + 1) * 10 },
      }),
    ),
  );

  res.json({ ok: true });
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
    throw HttpError.badRequest("Invalid flavour update", parsed.error.flatten());
  }
  const updated = await prisma.flavor.update({
    where: { id: req.params.id },
    data: parsed.data,
    select: flavorSelect,
  });
  res.json(withProductCount(updated));
});

adminFlavorRouter.delete("/:id", async (req, res) => {
  const existing = await prisma.flavor.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      name: true,
      _count: { select: { products: true } },
    },
  });
  if (!existing) throw HttpError.notFound("Flavour not found");

  const productCount = existing._count.products;
  if (productCount > 0) {
    throw HttpError.conflict(
      `Cannot delete “${existing.name}” — ${productCount} product${productCount === 1 ? "" : "s"} still offer it. Remove it from those products first, or turn Active off to hide it from the storefront.`,
    );
  }

  await prisma.flavor.delete({ where: { id: existing.id } });
  res.json({ id: existing.id, name: existing.name });
});
