import { Router } from "express";
import type { ProductTemplate } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";
import { requirePermission } from "../../middleware/auth.js";

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

// Order editors pick add-ons too, so reading is open to them; changes need addons.write.
const canReadAddons = requirePermission(
  "addons.write",
  "orders.update",
  "offline-orders.write",
  "products.read",
);
const canWriteAddons = requirePermission("addons.write");

const addonSelect = {
  id: true,
  slug: true,
  name: true,
  group: true,
  priceDelta: true,
  imageUrl: true,
  sortOrder: true,
  isActive: true,
  customTemplates: true,
  defaultCategories: { select: { id: true } },
  _count: { select: { products: true } },
} as const;

const TEMPLATE_ORDER: ProductTemplate[] = ["CAKE", "PIZZA", "OTHER"];

/**
 * Templates of the live products each add-on is offered on — attached directly,
 * or a default of the product's category or its parent (same rule as the PDP).
 * Custom order lines get these plus the add-on's own `customTemplates`.
 */
async function templatesByAddon(): Promise<Map<string, ProductTemplate[]>> {
  const [products, categoryDefaults] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true, archivedAt: null },
      select: {
        template: true,
        addons: { select: { id: true } },
        categoryLinks: { select: { categoryId: true, category: { select: { parentId: true } } } },
      },
    }),
    prisma.addon.findMany({ select: { id: true, defaultCategories: { select: { id: true } } } }),
  ]);
  const addonsByCategory = new Map<string, string[]>();
  for (const addon of categoryDefaults) {
    for (const { id } of addon.defaultCategories) {
      addonsByCategory.set(id, [...(addonsByCategory.get(id) ?? []), addon.id]);
    }
  }
  const found = new Map<string, Set<ProductTemplate>>();
  for (const product of products) {
    const ids = new Set(product.addons.map((a) => a.id));
    for (const link of product.categoryLinks) {
      for (const categoryId of [link.categoryId, link.category.parentId]) {
        if (categoryId) addonsByCategory.get(categoryId)?.forEach((id) => ids.add(id));
      }
    }
    for (const id of ids) {
      const templates = found.get(id) ?? new Set<ProductTemplate>();
      templates.add(product.template);
      found.set(id, templates);
    }
  }
  return new Map(
    [...found].map(([id, templates]) => [id, TEMPLATE_ORDER.filter((t) => templates.has(t))]),
  );
}

function serializeAddon<
  T extends {
    id: string;
    customTemplates: ProductTemplate[];
    defaultCategories: { id: string }[];
    _count: { products: number };
  },
>(row: T, autoByAddon: Map<string, ProductTemplate[]>) {
  const { defaultCategories, _count, ...addon } = row;
  const autoTemplates = autoByAddon.get(row.id) ?? [];
  return {
    ...addon,
    categoryIds: defaultCategories.map((c) => c.id),
    productCount: _count.products,
    autoTemplates,
    templates: TEMPLATE_ORDER.filter(
      (t) => autoTemplates.includes(t) || row.customTemplates.includes(t),
    ),
  };
}

adminAddonRouter.get("/", canReadAddons, async (_req, res) => {
  const [addons, templates] = await Promise.all([
    prisma.addon.findMany({
      orderBy: [{ group: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      select: addonSelect,
    }),
    templatesByAddon(),
  ]);
  res.json(addons.map((a) => serializeAddon(a, templates)));
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
  customTemplates: z.array(z.enum(["CAKE", "PIZZA", "OTHER"])).optional(),
});

adminAddonRouter.post("/", canWriteAddons, async (req, res) => {
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
  res.status(201).json(serializeAddon(created, await templatesByAddon()));
});

const updateAddonSchema = createAddonSchema.partial().extend({
  isActive: z.boolean().optional(),
});

adminAddonRouter.patch("/:id", canWriteAddons, async (req, res) => {
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
  res.json(serializeAddon(updated, await templatesByAddon()));
});

adminAddonRouter.delete("/:id", canWriteAddons, async (req, res) => {
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
