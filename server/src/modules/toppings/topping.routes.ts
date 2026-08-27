import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";

// Public: used by storefront to render pizza toppings/condiments.
export const toppingRouter = Router();

toppingRouter.get("/", async (req, res) => {
  const kind = typeof req.query.kind === "string" ? req.query.kind : undefined;
  const toppings = await prisma.topping.findMany({
    where: {
      isActive: true,
      ...(kind === "TOPPING" || kind === "CONDIMENT" ? { kind } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      kind: true,
      priceDelta: true,
      isVeg: true,
      imageUrl: true,
      sortOrder: true,
    },
  });
  res.setHeader("Cache-Control", "public, max-age=60");
  res.json(toppings);
});

// TODO: gate behind requireAuth + requirePermission("toppings.write") once auth is wired.
export const adminToppingRouter = Router();

adminToppingRouter.get("/", async (_req, res) => {
  const toppings = await prisma.topping.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      kind: true,
      priceDelta: true,
      isVeg: true,
      imageUrl: true,
      sortOrder: true,
      isActive: true,
    },
  });
  res.json(toppings);
});

const createToppingSchema = z.object({
  name: z.string().trim().min(1),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, digits, hyphens only"),
  kind: z.enum(["TOPPING", "CONDIMENT"]).default("TOPPING"),
  priceDelta: z.coerce.number().min(0).default(0),
  isVeg: z.boolean().default(true),
  imageUrl: z.string().url().nullable().optional(),
  sortOrder: z.coerce.number().int().default(0),
});

adminToppingRouter.post("/", async (req, res) => {
  const parsed = createToppingSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest("Invalid topping", parsed.error.flatten());
  }
  const dup = await prisma.topping.findUnique({
    where: { slug: parsed.data.slug },
    select: { id: true },
  });
  if (dup) throw HttpError.conflict("Slug already exists");
  const created = await prisma.topping.create({ data: parsed.data });
  res.status(201).json(created);
});

const updateToppingSchema = createToppingSchema.partial().extend({
  isActive: z.boolean().optional(),
});

adminToppingRouter.patch("/:id", async (req, res) => {
  const parsed = updateToppingSchema.safeParse(req.body);
  if (!parsed.success) {
    throw HttpError.badRequest(
      "Invalid topping update",
      parsed.error.flatten(),
    );
  }
  if (parsed.data.slug) {
    const dup = await prisma.topping.findFirst({
      where: { slug: parsed.data.slug, NOT: { id: req.params.id } },
      select: { id: true },
    });
    if (dup) throw HttpError.conflict("Slug already exists");
  }
  const updated = await prisma.topping.update({
    where: { id: req.params.id },
    data: parsed.data,
  });
  res.json(updated);
});
