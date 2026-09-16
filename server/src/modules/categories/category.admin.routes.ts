import { Router } from "express";
import { z } from "zod";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";

const departmentSelect = { id: true, slug: true, name: true } as const;

export const adminCategoryRouter = Router();

// Flat list with parent info + product/children counts so the admin table can render
// a tidy tree and disable delete when the row is in use.
adminCategoryRouter.get("/", async (_req, res) => {
  const rows = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      imageUrl: true,
      sortOrder: true,
      isActive: true,
      parentId: true,
      departmentId: true,
      department: { select: departmentSelect },
      parent: {
        select: {
          id: true,
          name: true,
          slug: true,
          department: { select: departmentSelect },
        },
      },
      _count: { select: { productLinks: true, children: true } },
    },
  });
  res.json(
    rows.map((r) => {
      const department = r.parentId ? (r.parent?.department ?? null) : r.department;
      return {
        id: r.id,
        slug: r.slug,
        name: r.name,
        description: r.description,
        imageUrl: r.imageUrl,
        sortOrder: r.sortOrder,
        isActive: r.isActive,
        parentId: r.parentId,
        departmentId: department?.id ?? null,
        department,
        parentName: r.parent?.name ?? null,
        parentSlug: r.parent?.slug ?? null,
        productCount: r._count.productLinks,
        childCount: r._count.children,
      };
    }),
  );
});

const slugRegex = /^[a-z0-9-]+$/;

const createSchema = z.object({
  name: z.string().trim().min(2),
  slug: z.string().trim().regex(slugRegex, "Lowercase letters, digits, hyphens"),
  description: z.string().trim().nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  parentId: z.string().nullable().optional(),
  departmentId: z.string().nullable().optional(),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
});

async function assertDepartment(id: string) {
  const dept = await prisma.department.findUnique({
    where: { id },
    select: { id: true, isActive: true },
  });
  if (!dept) throw HttpError.badRequest("Store not found");
  return dept;
}

adminCategoryRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid category", parsed.error.flatten());
  }
  const { parentId, departmentId, ...rest } = parsed.data;

  const dup = await prisma.category.findUnique({
    where: { slug: rest.slug },
    select: { id: true },
  });
  if (dup) throw HttpError.conflict("Slug already exists");

  if (parentId) {
    const parent = await prisma.category.findUnique({
      where: { id: parentId },
      select: { id: true, parentId: true },
    });
    if (!parent) throw HttpError.badRequest("Parent category not found");
    // Enforce our 2-level hierarchy so we don't accidentally build a jungle.
    if (parent.parentId)
      throw HttpError.badRequest("Only 2 levels supported — pick a top-level parent");
  } else if (!departmentId) {
    throw HttpError.badRequest("Pick a store for a top-level category");
  } else {
    await assertDepartment(departmentId);
  }

  const created = await prisma.category.create({
    data: {
      ...rest,
      parentId: parentId ?? null,
      departmentId: parentId ? null : departmentId,
    },
  });
  res.status(StatusCodes.CREATED).json(created);
});

const updateSchema = createSchema.partial();

adminCategoryRouter.patch("/:id", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid update", parsed.error.flatten());
  }

  const existing = await prisma.category.findUnique({
    where: { id: req.params.id },
    select: { id: true, parentId: true },
  });
  if (!existing) throw HttpError.notFound("Category not found");

  if (parsed.data.slug) {
    const dup = await prisma.category.findFirst({
      where: { slug: parsed.data.slug, NOT: { id: existing.id } },
      select: { id: true },
    });
    if (dup) throw HttpError.conflict("Slug already exists");
  }

  if (parsed.data.parentId !== undefined) {
    if (parsed.data.parentId === existing.id) {
      throw HttpError.badRequest("Category cannot be its own parent");
    }
    if (parsed.data.parentId) {
      const parent = await prisma.category.findUnique({
        where: { id: parsed.data.parentId },
        select: { id: true, parentId: true },
      });
      if (!parent) throw HttpError.badRequest("Parent category not found");
      if (parent.parentId) throw HttpError.badRequest("Only 2 levels supported");
      // If this row currently has children, it can't become a sub itself.
      const childCount = await prisma.category.count({
        where: { parentId: existing.id },
      });
      if (childCount > 0) throw HttpError.badRequest("Move sub-categories away first");
    }
  }

  const nextParentId =
    parsed.data.parentId !== undefined ? parsed.data.parentId : existing.parentId;

  if (!nextParentId && parsed.data.departmentId === null) {
    throw HttpError.badRequest("Pick a store for a top-level category");
  }

  if (!nextParentId && parsed.data.departmentId) {
    await assertDepartment(parsed.data.departmentId);
  }

  const { departmentId, ...rest } = parsed.data;
  const updated = await prisma.category.update({
    where: { id: existing.id },
    data: {
      ...rest,
      ...(nextParentId
        ? { departmentId: null }
        : departmentId !== undefined
          ? { departmentId }
          : {}),
    },
  });
  res.json(updated);
});

adminCategoryRouter.delete("/:id", async (req, res) => {
  const [productCount, childCount] = await Promise.all([
    prisma.productCategory.count({ where: { categoryId: req.params.id } }),
    prisma.category.count({ where: { parentId: req.params.id } }),
  ]);
  if (productCount > 0) {
    throw HttpError.conflict(`Cannot delete — ${productCount} product(s) still use this category`);
  }
  if (childCount > 0) {
    throw HttpError.conflict(
      `Cannot delete — ${childCount} sub-categor${childCount === 1 ? "y" : "ies"} still linked`,
    );
  }
  await prisma.category.delete({ where: { id: req.params.id } });
  res.status(StatusCodes.NO_CONTENT).end();
});
