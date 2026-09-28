import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";
import { sanitizeSiteLink } from "../../lib/siteLink.js";

export const heroRouter = Router();
export const adminHeroRouter = Router();

export const MAX_HERO_SLIDES = 6;

const slideSelect = {
  id: true,
  mediaType: true,
  desktopUrl: true,
  mobileUrl: true,
  posterUrl: true,
  title: true,
  subtitle: true,
  linkUrl: true,
  sortOrder: true,
  isActive: true,
} as const;

heroRouter.get("/", async (_req, res) => {
  const slides = await prisma.heroSlide.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: slideSelect,
  });
  res.setHeader("Cache-Control", "public, max-age=60");
  res.json(slides);
});

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => v || null);

const mediaUrl = z.string().trim().min(1).max(500);

const slideSchema = z.object({
  mediaType: z.enum(["IMAGE", "VIDEO"]),
  desktopUrl: mediaUrl,
  mobileUrl: mediaUrl.nullable().optional(),
  posterUrl: mediaUrl.nullable().optional(),
  title: optionalText(80),
  subtitle: optionalText(160),
  linkUrl: z.string().trim().max(300).nullable().optional(),
  isActive: z.boolean().optional(),
});

type SlideInput = z.infer<typeof slideSchema>;

function toSlideData(input: SlideInput) {
  return {
    mediaType: input.mediaType,
    desktopUrl: sanitizeSiteLink(input.desktopUrl)!,
    mobileUrl: sanitizeSiteLink(input.mobileUrl),
    // A poster only makes sense for video; drop a stale one when switching to image.
    posterUrl: input.mediaType === "VIDEO" ? sanitizeSiteLink(input.posterUrl) : null,
    title: input.title,
    subtitle: input.subtitle,
    linkUrl: sanitizeSiteLink(input.linkUrl),
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
  } satisfies Prisma.HeroSlideUncheckedUpdateInput;
}

adminHeroRouter.get("/", async (_req, res) => {
  const slides = await prisma.heroSlide.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: slideSelect,
  });
  res.json(slides);
});

adminHeroRouter.post("/", async (req, res) => {
  const parsed = slideSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid slide", parsed.error.flatten());
  }

  const slide = await prisma.$transaction(async (tx) => {
    const count = await tx.heroSlide.count();
    if (count >= MAX_HERO_SLIDES) {
      throw HttpError.badRequest(
        `You can have at most ${MAX_HERO_SLIDES} hero slides. Delete one first.`,
      );
    }
    const last = await tx.heroSlide.aggregate({ _max: { sortOrder: true } });
    return tx.heroSlide.create({
      data: {
        ...toSlideData(parsed.data),
        sortOrder: (last._max.sortOrder ?? -1) + 1,
      },
      select: slideSelect,
    });
  });
  res.status(201).json(slide);
});

const reorderSchema = z.object({
  ids: z.array(z.string().min(1)).max(MAX_HERO_SLIDES),
});

// Registered before "/:id" so "reorder" isn't treated as an id.
adminHeroRouter.patch("/reorder", async (req, res) => {
  const parsed = reorderSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid order", parsed.error.flatten());
  }
  await prisma.$transaction(
    parsed.data.ids.map((id, index) =>
      prisma.heroSlide.update({ where: { id }, data: { sortOrder: index } }),
    ),
  );
  const slides = await prisma.heroSlide.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: slideSelect,
  });
  res.json(slides);
});

adminHeroRouter.patch("/:id", async (req, res) => {
  const parsed = slideSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid slide", parsed.error.flatten());
  }
  const existing = await prisma.heroSlide.findUnique({
    where: { id: req.params.id },
    select: { id: true },
  });
  if (!existing) throw HttpError.notFound("Slide not found");

  const slide = await prisma.heroSlide.update({
    where: { id: existing.id },
    data: toSlideData(parsed.data),
    select: slideSelect,
  });
  res.json(slide);
});

adminHeroRouter.patch("/:id/active", async (req, res) => {
  const parsed = z.object({ isActive: z.boolean() }).safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid input", parsed.error.flatten());
  }
  const slide = await prisma.heroSlide
    .update({
      where: { id: req.params.id },
      data: { isActive: parsed.data.isActive },
      select: slideSelect,
    })
    .catch(() => {
      throw HttpError.notFound("Slide not found");
    });
  res.json(slide);
});

adminHeroRouter.delete("/:id", async (req, res) => {
  await prisma.heroSlide.delete({ where: { id: req.params.id } }).catch(() => {
    throw HttpError.notFound("Slide not found");
  });
  res.json({ ok: true });
});
