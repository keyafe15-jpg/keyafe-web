import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";

export const tagRouter = Router();

tagRouter.get("/", async (_req, res) => {
  const tags = await prisma.tag.findMany({
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      colorHex: true,
    },
  });
  res.setHeader("Cache-Control", "public, max-age=60");
  res.json(tags);
});

export const adminTagRouter = Router();

adminTagRouter.get("/", async (_req, res) => {
  const tags = await prisma.tag.findMany({
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      colorHex: true,
      _count: { select: { products: true } },
    },
  });
  res.json(
    tags.map(({ _count, ...tag }) => ({
      ...tag,
      productCount: _count.products,
    })),
  );
});

const colorHexSchema = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Use a 6-digit hex color like #E31C79")
  .nullable()
  .optional();

const createTagSchema = z.object({
  name: z.string().trim().min(1),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, digits, hyphens only"),
  colorHex: colorHexSchema,
});

adminTagRouter.post("/", async (req, res) => {
  const parsed = createTagSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid tag", parsed.error.flatten());
  }
  const dup = await prisma.tag.findUnique({
    where: { slug: parsed.data.slug },
    select: { id: true },
  });
  if (dup) throw HttpError.conflict("Slug already exists");
  const created = await prisma.tag.create({
    data: {
      name: parsed.data.name,
      slug: parsed.data.slug,
      colorHex: parsed.data.colorHex ?? null,
    },
  });
  res.status(201).json({ ...created, productCount: 0 });
});

const updateTagSchema = createTagSchema.partial();

adminTagRouter.patch("/:id", async (req, res) => {
  const parsed = updateTagSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid tag update", parsed.error.flatten());
  }
  if (parsed.data.slug) {
    const dup = await prisma.tag.findFirst({
      where: { slug: parsed.data.slug, NOT: { id: req.params.id } },
      select: { id: true },
    });
    if (dup) throw HttpError.conflict("Slug already exists");
  }
  const updated = await prisma.tag.update({
    where: { id: req.params.id },
    data: parsed.data,
    include: { _count: { select: { products: true } } },
  });
  const { _count, ...tag } = updated;
  res.json({ ...tag, productCount: _count.products });
});
