import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";
import { sanitizeSiteLink } from "../../lib/siteLink.js";
import { istDayOf, istDayStart } from "../../lib/time.js";

export const adminHighlightRouter = Router();

export const MAX_HIGHLIGHTS = 6;

const DAY_MS = 24 * 60 * 60 * 1000;

const highlightSelect = {
  id: true,
  title: true,
  tagline: true,
  themeColor: true,
  bannerImage: true,
  startsAt: true,
  endsAt: true,
  isActive: true,
  sortOrder: true,
  category: { select: { id: true, name: true, slug: true } },
  tag: { select: { id: true, name: true, slug: true } },
  products: {
    select: { id: true, name: true, images: true },
    orderBy: { name: "asc" },
  },
} as const;

type HighlightRow = {
  startsAt: Date | null;
  endsAt: Date | null;
  products: { id: string; name: string; images: string[] }[];
} & Record<string, unknown>;

/** Dates go out as the India calendar day (YYYY-MM-DD) the admin picked. */
function toView<T extends HighlightRow>(row: T) {
  const { startsAt, endsAt, products, ...rest } = row;
  return {
    ...rest,
    startDate: startsAt ? istDayOf(startsAt).toISOString().slice(0, 10) : null,
    endDate: endsAt ? istDayOf(endsAt).toISOString().slice(0, 10) : null,
    products: products.map((p) => ({ id: p.id, name: p.name, image: p.images[0] ?? null })),
  };
}

const dateKey = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-12-15")
  .nullable()
  .optional()
  .transform((v) => v || null);

const highlightSchema = z
  .object({
    title: z.string().trim().min(2, "Add a title").max(60),
    tagline: z
      .string()
      .trim()
      .max(140)
      .nullable()
      .optional()
      .transform((v) => v || null),
    themeColor: z
      .string()
      .trim()
      .regex(/^#[0-9a-fA-F]{6}$/, "Pick a colour"),
    bannerImage: z.string().trim().max(500).nullable().optional(),
    startDate: dateKey,
    endDate: dateKey,
    categoryId: z.string().min(1).nullable().optional(),
    tagId: z.string().min(1).nullable().optional(),
    productIds: z.array(z.string().min(1)).max(24).default([]),
    isActive: z.boolean().optional(),
  })
  .refine((v) => v.productIds.length > 0 || v.categoryId || v.tagId, {
    message: "Pick products, a category or a tag",
    path: ["productIds"],
  })
  .refine((v) => !v.startDate || !v.endDate || v.endDate >= v.startDate, {
    message: "End date can't be before the start date",
    path: ["endDate"],
  });

type HighlightInput = z.infer<typeof highlightSchema>;

function toData(input: HighlightInput) {
  const startsAt = input.startDate ? istDayStart(new Date(`${input.startDate}T00:00:00Z`)) : null;
  const endsAt = input.endDate
    ? new Date(istDayStart(new Date(`${input.endDate}T00:00:00Z`)).getTime() + DAY_MS - 1)
    : null;
  return {
    title: input.title,
    tagline: input.tagline,
    themeColor: input.themeColor,
    bannerImage: sanitizeSiteLink(input.bannerImage),
    startsAt,
    endsAt,
    categoryId: input.categoryId ?? null,
    tagId: input.tagId ?? null,
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
  };
}

async function parse(body: unknown) {
  const parsed = highlightSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid highlight";
    throw HttpError.badRequest(first, parsed.error.flatten());
  }
  const input = { ...parsed.data, productIds: [...new Set(parsed.data.productIds)] };
  const [products, category, tag] = await Promise.all([
    prisma.product.count({ where: { id: { in: input.productIds } } }),
    input.categoryId ? prisma.category.count({ where: { id: input.categoryId } }) : 1,
    input.tagId ? prisma.tag.count({ where: { id: input.tagId } }) : 1,
  ]);
  if (products !== input.productIds.length) throw HttpError.badRequest("Product not found");
  if (!category) throw HttpError.badRequest("Category not found");
  if (!tag) throw HttpError.badRequest("Tag not found");
  return input;
}

async function listAll() {
  const rows = await prisma.highlight.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: highlightSelect,
  });
  return rows.map(toView);
}

adminHighlightRouter.get("/", async (_req, res) => {
  res.json(await listAll());
});

adminHighlightRouter.post("/", async (req, res) => {
  const input = await parse(req.body);
  const created = await prisma.$transaction(async (tx) => {
    const count = await tx.highlight.count();
    if (count >= MAX_HIGHLIGHTS) {
      throw HttpError.badRequest(
        `You can have at most ${MAX_HIGHLIGHTS} highlights. Delete one first.`,
      );
    }
    const last = await tx.highlight.aggregate({ _max: { sortOrder: true } });
    return tx.highlight.create({
      data: {
        ...toData(input),
        sortOrder: (last._max.sortOrder ?? -1) + 1,
        products: { connect: input.productIds.map((id) => ({ id })) },
      },
      select: highlightSelect,
    });
  });
  res.status(201).json(toView(created));
});

const reorderSchema = z.object({
  ids: z.array(z.string().min(1)).max(MAX_HIGHLIGHTS),
});

// Registered before "/:id" so "reorder" isn't treated as an id.
adminHighlightRouter.patch("/reorder", async (req, res) => {
  const parsed = reorderSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid order", parsed.error.flatten());
  }
  await prisma.$transaction(
    parsed.data.ids.map((id, index) =>
      prisma.highlight.update({ where: { id }, data: { sortOrder: index } }),
    ),
  );
  res.json(await listAll());
});

adminHighlightRouter.patch("/:id", async (req, res) => {
  const input = await parse(req.body);
  const existing = await prisma.highlight.findUnique({
    where: { id: req.params.id },
    select: { id: true },
  });
  if (!existing) throw HttpError.notFound("Highlight not found");
  const updated = await prisma.highlight.update({
    where: { id: existing.id },
    data: {
      ...toData(input),
      products: { set: input.productIds.map((id) => ({ id })) },
    },
    select: highlightSelect,
  });
  res.json(toView(updated));
});

adminHighlightRouter.patch("/:id/active", async (req, res) => {
  const parsed = z.object({ isActive: z.boolean() }).safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid input", parsed.error.flatten());
  }
  const updated = await prisma.highlight
    .update({
      where: { id: req.params.id },
      data: { isActive: parsed.data.isActive },
      select: highlightSelect,
    })
    .catch(() => {
      throw HttpError.notFound("Highlight not found");
    });
  res.json(toView(updated));
});

adminHighlightRouter.delete("/:id", async (req, res) => {
  await prisma.highlight.delete({ where: { id: req.params.id } }).catch(() => {
    throw HttpError.notFound("Highlight not found");
  });
  res.json({ ok: true });
});
