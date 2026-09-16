import { Router } from "express";
import { z } from "zod";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";

const departmentSelect = {
  id: true,
  slug: true,
  name: true,
  sortOrder: true,
  isActive: true,
  accentHex: true,
  softHex: true,
  deepHex: true,
} as const;

export const departmentRouter = Router();

departmentRouter.get("/", async (_req, res) => {
  const rows = await prisma.department.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      sortOrder: true,
      accentHex: true,
      softHex: true,
      deepHex: true,
    },
  });
  res.setHeader("Cache-Control", "public, max-age=60");
  res.json(rows);
});

export const adminDepartmentRouter = Router();

adminDepartmentRouter.get("/", async (_req, res) => {
  const rows = await prisma.department.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      ...departmentSelect,
      _count: { select: { categories: true } },
    },
  });
  res.json(
    rows.map(({ _count, ...row }) => ({
      ...row,
      categoryCount: _count.categories,
    })),
  );
});

const slugRegex = /^[a-z0-9-]+$/;
const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Use a hex color like #E31C79")
  .transform((value) => value.toUpperCase());

const createSchema = z.object({
  name: z.string().trim().min(2),
  slug: z.string().trim().regex(slugRegex, "Lowercase letters, digits, hyphens"),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
  accentHex: hexColor.default("#E31C79"),
  softHex: hexColor.default("#F8D7E6"),
  deepHex: hexColor.default("#B0155F"),
});

adminDepartmentRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid store", parsed.error.flatten());
  }
  const dup = await prisma.department.findUnique({
    where: { slug: parsed.data.slug },
    select: { id: true },
  });
  if (dup) throw HttpError.conflict("Slug already exists");
  const created = await prisma.department.create({ data: parsed.data });
  res.status(StatusCodes.CREATED).json({ ...created, categoryCount: 0 });
});

const updateSchema = createSchema.partial();

adminDepartmentRouter.patch("/:id", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid update", parsed.error.flatten());
  }
  const existing = await prisma.department.findUnique({
    where: { id: req.params.id },
    select: { id: true },
  });
  if (!existing) throw HttpError.notFound("Store not found");

  if (parsed.data.slug) {
    const dup = await prisma.department.findFirst({
      where: { slug: parsed.data.slug, NOT: { id: existing.id } },
      select: { id: true },
    });
    if (dup) throw HttpError.conflict("Slug already exists");
  }

  const updated = await prisma.department.update({
    where: { id: existing.id },
    data: parsed.data,
    include: { _count: { select: { categories: true } } },
  });
  const { _count, ...row } = updated;
  res.json({ ...row, categoryCount: _count.categories });
});

adminDepartmentRouter.delete("/:id", async (req, res) => {
  const existing = await prisma.department.findUnique({
    where: { id: req.params.id },
    select: { id: true },
  });
  if (!existing) throw HttpError.notFound("Store not found");

  const categoryCount = await prisma.category.count({
    where: { departmentId: existing.id },
  });
  if (categoryCount > 0) {
    throw HttpError.conflict(
      `Cannot delete — ${categoryCount} categor${categoryCount === 1 ? "y" : "ies"} still use this store`,
    );
  }
  await prisma.department.delete({ where: { id: existing.id } });
  res.status(StatusCodes.NO_CONTENT).end();
});
