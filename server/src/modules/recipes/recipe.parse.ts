import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";
import { logger } from "../../utils/logger.js";
import { geminiGenerateText, type SuggestImage } from "../ai/ai.service.js";
import { buildRecipePrompt } from "../ai/prompts/recipe.js";
import {
  mapRecipeUnit,
  parseRecipeQty,
  qtyNum,
  RECIPE_UNITS,
  unitFromQtyText,
  type RecipeUnitKey,
} from "./recipe.shared.js";

export type RecipeDraftLine = {
  name: string;
  qty: number;
  unit: RecipeUnitKey;
  note: string | null;
  buyItemId?: string;
  componentRecipeId?: string;
};

export type RecipeDraftUsage = {
  axis1: string;
  axis2: string | null;
  qty: number;
  unit: RecipeUnitKey;
};

export type RecipeDraft = {
  name: string;
  categoryId: string | null;
  categorySlug: string | null;
  yieldQty: number | null;
  yieldUnit: RecipeUnitKey | null;
  yieldNote: string | null;
  ingredients: RecipeDraftLine[];
  usage: RecipeDraftUsage[];
  steps: string[];
  uncertain: boolean;
};

function asObject(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fence?.[1] ?? trimmed).trim();
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("not an object");
  }
  return parsed as Record<string, unknown>;
}

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t || null;
}

function num(v: unknown): number | null {
  return parseRecipeQty(v);
}

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export async function parseRecipe(opts: {
  image: SuggestImage;
  context?: string | null;
}): Promise<RecipeDraft> {
  const [categories, items, recipes] = await Promise.all([
    prisma.category.findMany({
      where: { isActive: true },
      select: { id: true, slug: true, name: true },
      orderBy: { sortOrder: "asc" },
      take: 80,
    }),
    prisma.buyItem.findMany({
      where: { isActive: true, archivedAt: null },
      select: { id: true, name: true, unit: true },
      orderBy: { name: "asc" },
      take: 80,
    }),
    prisma.recipe.findMany({
      where: { archivedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 80,
    }),
  ]);

  let text: string;
  try {
    text = await geminiGenerateText({
      prompt: buildRecipePrompt(
        {
          categories: categories.map((c) => ({ slug: c.slug, name: c.name })),
          items: items.map((i) => ({ name: i.name, unit: i.unit })),
          recipes: recipes.map((r) => ({ name: r.name })),
        },
        opts.context,
      ),
      image: opts.image,
      temperature: 0.15,
      maxOutputTokens: 4096,
      timeoutMs: 45_000,
    });
  } catch (err) {
    if (err instanceof HttpError) throw err;
    logger.warn({ err }, "recipe parse failed");
    throw HttpError.badGateway("Could not read that recipe.");
  }

  let raw: Record<string, unknown>;
  try {
    raw = asObject(text);
  } catch {
    throw HttpError.badGateway("Could not read that recipe.");
  }

  const catRaw = str(raw.category);
  const category =
    categories.find((c) => c.slug === catRaw || norm(c.name) === norm(catRaw ?? "")) ??
    categories.find((c) => catRaw && norm(c.name).includes(norm(catRaw))) ??
    null;

  const rawLines = Array.isArray(raw.ingredients) ? raw.ingredients : [];
  const ingredients: RecipeDraftLine[] = [];
  for (const row of rawLines) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const name = str(r.name);
    const qty = num(r.qty) ?? (name ? num(name) : null);
    if (!name || !(qty != null && qty > 0)) continue;
    const recipeName = str(r.recipeName);
    const component = recipeName
      ? recipes.find((x) => norm(x.name) === norm(recipeName) || norm(x.name).includes(norm(recipeName)))
      : undefined;
    const item = items.find((x) => norm(x.name) === norm(name) || norm(name).includes(norm(x.name)));
    ingredients.push({
      name: component?.name ?? name,
      qty: qtyNum(qty),
      unit: unitFromQtyText(r.qty) ?? unitFromQtyText(name) ?? mapRecipeUnit(r.unit),
      note: str(r.note),
      buyItemId: component ? undefined : item?.id,
      componentRecipeId: component?.id,
    });
  }

  const rawUsage = Array.isArray(raw.usage) ? raw.usage : [];
  const usage: RecipeDraftUsage[] = [];
  for (const row of rawUsage) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const axis1 = str(r.axis1);
    const qty = num(r.qty);
    if (!axis1 || !(qty != null && qty > 0)) continue;
    usage.push({
      axis1,
      axis2: str(r.axis2),
      qty: qtyNum(qty),
      unit: unitFromQtyText(r.qty) ?? mapRecipeUnit(r.unit),
    });
  }

  const steps = Array.isArray(raw.steps)
    ? raw.steps
        .map((s) => (typeof s === "string" ? s.trim() : ""))
        .filter(Boolean)
        .slice(0, 40)
    : [];

  const yieldUnitRaw = str(raw.yieldUnit);
  return {
    name: str(raw.name) || "Untitled recipe",
    categoryId: category?.id ?? null,
    categorySlug: category?.slug ?? null,
    yieldQty: num(raw.yieldQty),
    yieldUnit:
      yieldUnitRaw && (RECIPE_UNITS as readonly string[]).includes(yieldUnitRaw.toUpperCase())
        ? (yieldUnitRaw.toUpperCase() as RecipeUnitKey)
        : yieldUnitRaw
          ? mapRecipeUnit(yieldUnitRaw)
          : null,
    yieldNote: str(raw.yieldNote),
    ingredients,
    usage,
    steps,
    uncertain: raw.uncertain === true,
  };
}
