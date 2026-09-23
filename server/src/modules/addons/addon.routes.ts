import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";

export const addonRouter = Router();

addonRouter.get("/", async (_req, res) => {
  const addons = await prisma.addon.findMany({
    where: { isActive: true },
    orderBy: [{ group: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      group: true,
      priceDelta: true,
      imageUrl: true,
      sortOrder: true,
    },
  });
  res.setHeader("Cache-Control", "public, max-age=60");
  res.json(addons);
});

export const adminAddonRouter = Router();

const addonSelect = {
  id: true,
  slug: true,
  name: true,
  group: true,
  priceDelta: true,
  imageUrl: true,
  sortOrder: true,
  isActive: true,
  defaultCategories: { select: { id: true } },
  _count: { select: { products: true } },
} as const;

function serializeAddon<
  T extends {
    defaultCategories: { id: string }[];
    _count: { products: number };
  },
>(row: T) {
  const { defaultCategories, _count, ...addon } = row;
  return {
    ...addon,
    categoryIds: defaultCategories.map((c) => c.id),
    productCount: _count.products,
  };
}

adminAddonRouter.get("/", async (_req, res) => {
  const addons = await prisma.addon.findMany({
    orderBy: [{ group: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    select: addonSelect,
  });
  res.json(addons.map(serializeAddon));
});

const createAddonSchema = z.object({
  name: z.string().trim().min(1),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, digits, hyphens only"),
  group: z.string().trim().min(1),
  priceDelta: z.coerce.number().min(0).default(0),
  imageUrl: z.string().url().nullable().optional(),
  sortOrder: z.coerce.number().int().default(0),
  categoryIds: z.array(z.string().min(1)).optional(),
});

adminAddonRouter.post("/", async (req, res) => {
  const parsed = createAddonSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid add-on", parsed.error.flatten());
  }
  const { categoryIds, ...data } = parsed.data;
  const dup = await prisma.addon.findUnique({
    where: { slug: data.slug },
    select: { id: true },
  });
  if (dup) throw HttpError.conflict("Slug already exists");
  const created = await prisma.addon.create({
    data: {
      ...data,
      defaultCategories: categoryIds?.length
        ? { connect: categoryIds.map((id) => ({ id })) }
        : undefined,
    },
    select: addonSelect,
  });
  res.status(201).json(serializeAddon(created));
});

const updateAddonSchema = createAddonSchema.partial().extend({
  isActive: z.boolean().optional(),
});

adminAddonRouter.patch("/:id", async (req, res) => {
  const parsed = updateAddonSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid add-on update", parsed.error.flatten());
  }
  if (parsed.data.slug) {
    const dup = await prisma.addon.findFirst({
      where: { slug: parsed.data.slug, NOT: { id: req.params.id } },
      select: { id: true },
    });
    if (dup) throw HttpError.conflict("Slug already exists");
  }
  const { categoryIds, ...data } = parsed.data;
  const updated = await prisma.addon.update({
    where: { id: req.params.id },
    data: {
      ...data,
      ...(categoryIds !== undefined
        ? {
            defaultCategories: {
              set: categoryIds.map((id) => ({ id })),
            },
          }
        : {}),
    },
    select: addonSelect,
  });
  res.json(serializeAddon(updated));
});

adminAddonRouter.delete("/:id", async (req, res) => {
  const existing = await prisma.addon.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      name: true,
      _count: { select: { products: true } },
    },
  });
  if (!existing) throw HttpError.notFound("Add-on not found");

  const productCount = existing._count.products;
  if (productCount > 0) {
    throw HttpError.conflict(
      `Cannot delete “${existing.name}” — ${productCount} product${productCount === 1 ? "" : "s"} still offer this add-on. Remove it from those products first, or turn Active off to hide it from the storefront.`,
    );
  }

  await prisma.addon.delete({ where: { id: existing.id } });
  res.json({ id: existing.id, name: existing.name });
});
