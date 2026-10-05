import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";
import { flattenFlavorGroup, flavorGroupSelect } from "./flavor.group.js";

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
      group: flavorGroupSelect,
      isEggless: true,
      isSugarFree: true,
      isHealthy: true,
      imageUrl: true,
      additionalAmount: true,
      sortOrder: true,
    },
  });
  res.setHeader("Cache-Control", "public, max-age=60");
  res.json(flavors.map(flattenFlavorGroup));
});

// TODO: gate behind requireAuth + requirePermission("flavours.write") once auth is wired.
export const adminFlavorRouter = Router();

const flavorSelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  groupId: true,
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

function rethrowMissingGroup(err: unknown): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
    throw HttpError.badRequest("That flavour group no longer exists");
  }
  throw err;
}

const orderedIdsSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});

function parseOrderedIds(body: unknown) {
  const parsed = orderedIdsSchema.safeParse(body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid reorder payload", parsed.error.flatten());
  }
  const { orderedIds } = parsed.data;
  if (new Set(orderedIds).size !== orderedIds.length) {
    throw HttpError.badRequest("Duplicate ids in reorder list");
  }
  return orderedIds;
}

// ---- Groups ----

const groupSelect = {
  id: true,
  name: true,
  sortOrder: true,
  _count: { select: { flavors: true } },
} as const;

function withFlavourCount<T extends { _count: { flavors: number } }>(row: T) {
  const { _count, ...rest } = row;
  return { ...rest, flavourCount: _count.flavors };
}

const groupNameSchema = z.object({
  name: z.string().trim().min(1, "Group name is required").max(40),
});

function rethrowDuplicateGroup(err: unknown): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    throw HttpError.conflict("A group with this name already exists");
  }
  throw err;
}

adminFlavorRouter.get("/groups", async (_req, res) => {
  const groups = await prisma.flavorGroup.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: groupSelect,
  });
  res.json(groups.map(withFlavourCount));
});

adminFlavorRouter.post("/groups", async (req, res) => {
  const parsed = groupNameSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid group", parsed.error.flatten());
  }
  const last = await prisma.flavorGroup.aggregate({ _max: { sortOrder: true } });
  const created = await prisma.flavorGroup
    .create({
      data: { name: parsed.data.name, sortOrder: (last._max.sortOrder ?? 0) + 10 },
      select: groupSelect,
    })
    .catch(rethrowDuplicateGroup);
  res.status(StatusCodes.CREATED).json(withFlavourCount(created));
});

adminFlavorRouter.post("/groups/reorder", async (req, res) => {
  const orderedIds = parseOrderedIds(req.body);
  const existing = await prisma.flavorGroup.count({ where: { id: { in: orderedIds } } });
  if (existing !== orderedIds.length) {
    throw HttpError.badRequest("One or more groups were not found");
  }
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.flavorGroup.update({ where: { id }, data: { sortOrder: (index + 1) * 10 } }),
    ),
  );
  res.json({ ok: true });
});

adminFlavorRouter.patch("/groups/:id", async (req, res) => {
  const parsed = groupNameSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid group", parsed.error.flatten());
  }
  const updated = await prisma.flavorGroup
    .update({ where: { id: req.params.id }, data: { name: parsed.data.name }, select: groupSelect })
    .catch(rethrowDuplicateGroup);
  res.json(withFlavourCount(updated));
});

adminFlavorRouter.delete("/groups/:id", async (req, res) => {
  const existing = await prisma.flavorGroup.findUnique({
    where: { id: req.params.id },
    select: { id: true, name: true },
  });
  if (!existing) throw HttpError.notFound("Group not found");
  await prisma.flavorGroup.delete({ where: { id: existing.id } });
  res.json(existing);
});

// ---- Flavours ----

adminFlavorRouter.get("/", async (_req, res) => {
  const flavors = await prisma.flavor.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: flavorSelect,
  });
  res.json(flavors.map(withProductCount));
});

const groupIdSchema = z.string().min(1).nullable().optional();

const createFlavorSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, digits and hyphens only")
    .optional(),
  description: z.string().trim().nullable().optional(),
  groupId: groupIdSchema,
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

  const { name, description, groupId, isEggless, isSugarFree, isHealthy, additionalAmount, isActive } =
    parsed.data;
  const slug = (parsed.data.slug?.trim() || slugifyFlavour(name)) || "flavour";
  const last = await prisma.flavor.aggregate({ _max: { sortOrder: true } });
  const sortOrder = parsed.data.sortOrder ?? (last._max.sortOrder ?? 0) + 10;

  try {
    const created = await prisma.flavor.create({
      data: {
        name,
        slug,
        description: description ?? null,
        groupId: groupId ?? null,
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
    rethrowMissingGroup(err);
  }
});

adminFlavorRouter.post("/reorder", async (req, res) => {
  const orderedIds = parseOrderedIds(req.body);
  const existing = await prisma.flavor.count({ where: { id: { in: orderedIds } } });
  if (existing !== orderedIds.length) {
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
  groupId: groupIdSchema,
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
  const updated = await prisma.flavor
    .update({
      where: { id: req.params.id },
      data: parsed.data,
      select: flavorSelect,
    })
    .catch(rethrowMissingGroup);
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
