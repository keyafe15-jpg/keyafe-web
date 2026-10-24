import type { Prisma, RecipeUnit } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";
import {
  qtyNum,
  recipeInclude,
  recipeVersionInclude,
  RECIPE_UNITS,
  type RecipeUnitKey,
} from "./recipe.shared.js";

export type IngredientInput = {
  name?: string;
  qty: number;
  unit: RecipeUnitKey;
  note?: string | null;
  buyItemId?: string | null;
  componentRecipeId?: string | null;
};

export type UsageInput = {
  axis1: string;
  axis2?: string | null;
  qty: number;
  unit: RecipeUnitKey;
};

export type VersionFields = {
  yieldQty?: number | null;
  yieldUnit?: RecipeUnitKey | null;
  yieldNote?: string | null;
  ingredients: IngredientInput[];
  steps: string[];
  usage: UsageInput[];
};

function unitOr(u: string | null | undefined): RecipeUnit | null {
  if (!u) return null;
  return (RECIPE_UNITS as readonly string[]).includes(u) ? (u as RecipeUnit) : "G";
}

export function serializeIngredient(row: {
  id: string;
  name: string;
  qty: { toString(): string } | number;
  unit: string;
  note: string | null;
  sortOrder: number;
  buyItemId: string | null;
  buyItem: { id: string; name: string } | null;
  componentRecipeId: string | null;
  componentRecipe: { id: string; name: string } | null;
}) {
  return {
    id: row.id,
    name: row.componentRecipe?.name ?? row.name,
    qty: qtyNum(row.qty),
    unit: row.unit,
    note: row.note,
    sortOrder: row.sortOrder,
    buyItemId: row.buyItemId,
    buyItem: row.buyItem,
    componentRecipeId: row.componentRecipeId,
    componentRecipe: row.componentRecipe,
  };
}

export function serializeVersion(row: {
  id: string;
  recipeId: string;
  label: string;
  yieldQty: { toString(): string } | number | null;
  yieldUnit: string | null;
  yieldNote: string | null;
  printedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  ingredients: Parameters<typeof serializeIngredient>[0][];
  steps: { id: string; sortOrder: number; text: string }[];
  usageRows: {
    id: string;
    axis1: string;
    axis2: string | null;
    qty: { toString(): string } | number;
    unit: string;
    sortOrder: number;
  }[];
}) {
  return {
    id: row.id,
    recipeId: row.recipeId,
    label: row.label,
    yieldQty: row.yieldQty == null ? null : qtyNum(row.yieldQty),
    yieldUnit: row.yieldUnit,
    yieldNote: row.yieldNote,
    printedAt: row.printedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ingredients: row.ingredients.map(serializeIngredient),
    steps: row.steps.map((s) => ({ id: s.id, sortOrder: s.sortOrder, text: s.text })),
    usage: row.usageRows.map((u) => ({
      id: u.id,
      axis1: u.axis1,
      axis2: u.axis2,
      qty: qtyNum(u.qty),
      unit: u.unit,
      sortOrder: u.sortOrder,
    })),
  };
}

export function serializeRecipe(row: {
  id: string;
  name: string;
  categoryId: string;
  currentVersionId: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  category: { id: string; slug: string; name: string; parentId: string | null };
  currentVersion: Parameters<typeof serializeVersion>[0] | null;
  versions?: Parameters<typeof serializeVersion>[0][];
}) {
  const versions = (row.versions ?? []).map(serializeVersion);
  const current =
    versions.find((v) => v.id === row.currentVersionId) ??
    (row.currentVersion ? serializeVersion(row.currentVersion) : null);
  return {
    id: row.id,
    name: row.name,
    categoryId: row.categoryId,
    category: row.category,
    currentVersionId: row.currentVersionId,
    currentVersion: current,
    printed: Boolean(current?.printedAt),
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    versions,
  };
}

export function serializeRecipeList(row: {
  id: string;
  name: string;
  categoryId: string;
  currentVersionId: string | null;
  archivedAt: Date | null;
  updatedAt: Date;
  category: { id: string; slug: string; name: string; parentId: string | null };
  currentVersion: {
    id: string;
    label: string;
    printedAt: Date | null;
    yieldQty: { toString(): string } | number | null;
    yieldUnit: string | null;
    _count?: { ingredients: number };
  } | null;
}) {
  const cur = row.currentVersion;
  return {
    id: row.id,
    name: row.name,
    categoryId: row.categoryId,
    category: row.category,
    currentVersionId: row.currentVersionId,
    versionLabel: cur?.label ?? "v1",
    yieldQty: cur?.yieldQty == null ? null : qtyNum(cur.yieldQty),
    yieldUnit: cur?.yieldUnit ?? null,
    printed: Boolean(cur?.printedAt),
    printedAt: cur?.printedAt?.toISOString() ?? null,
    ingredientCount: cur?._count?.ingredients ?? 0,
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function wouldCycle(parentRecipeId: string, childRecipeId: string): Promise<boolean> {
  if (parentRecipeId === childRecipeId) return true;
  const seen = new Set<string>([parentRecipeId]);
  const queue = [childRecipeId];
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) return true;
    seen.add(id);
    const recipe = await prisma.recipe.findUnique({
      where: { id },
      select: { currentVersionId: true },
    });
    if (!recipe?.currentVersionId) continue;
    const kids = await prisma.recipeIngredient.findMany({
      where: { versionId: recipe.currentVersionId, componentRecipeId: { not: null } },
      select: { componentRecipeId: true },
    });
    for (const k of kids) {
      if (k.componentRecipeId) queue.push(k.componentRecipeId);
    }
  }
  return false;
}

async function normalizeIngredients(
  recipeId: string,
  lines: IngredientInput[],
): Promise<Prisma.RecipeIngredientUncheckedCreateWithoutVersionInput[]> {
  const out: Prisma.RecipeIngredientUncheckedCreateWithoutVersionInput[] = [];
  for (const [i, line] of lines.entries()) {
    if (!(line.qty > 0)) continue;
    const componentId = line.componentRecipeId || null;
    if (componentId) {
      const exists = await prisma.recipe.findUnique({
        where: { id: componentId },
        select: { id: true, name: true, archivedAt: true },
      });
      if (!exists || exists.archivedAt) throw HttpError.badRequest("Nested recipe not found.");
      if (await wouldCycle(recipeId, componentId)) {
        throw HttpError.badRequest("A recipe cannot include itself.");
      }
      out.push({
        name: exists.name,
        qty: line.qty,
        unit: line.unit,
        note: line.note?.trim() || null,
        sortOrder: i,
        componentRecipeId: componentId,
      });
      continue;
    }
    const name = line.name?.trim();
    if (!name) continue;
    out.push({
      name,
      qty: line.qty,
      unit: line.unit,
      note: line.note?.trim() || null,
      sortOrder: i,
      buyItemId: line.buyItemId || null,
    });
  }
  if (out.length === 0) throw HttpError.badRequest("Add at least one ingredient.");
  return out;
}

function normalizeSteps(steps: string[]): Prisma.RecipeStepCreateWithoutVersionInput[] {
  return steps
    .map((t) => t.trim())
    .filter(Boolean)
    .map((text, i) => ({ text, sortOrder: i }));
}

function normalizeUsage(rows: UsageInput[]): Prisma.RecipeUsageRowCreateWithoutVersionInput[] {
  return rows
    .filter((r) => r.axis1.trim() && r.qty > 0)
    .map((r, i) => ({
      axis1: r.axis1.trim(),
      axis2: r.axis2?.trim() || null,
      qty: r.qty,
      unit: r.unit,
      sortOrder: i,
    }));
}

export async function listRecipes(opts: {
  q?: string;
  category?: string;
  printed?: "yes" | "no";
  page: number;
  pageSize: number;
  skip: number;
}) {
  const where: Prisma.RecipeWhereInput = { archivedAt: null };
  if (opts.q?.trim()) {
    where.name = { contains: opts.q.trim(), mode: "insensitive" };
  }
  if (opts.category) {
    where.category = { OR: [{ id: opts.category }, { slug: opts.category }] };
  }
  if (opts.printed === "yes") {
    where.currentVersion = { printedAt: { not: null } };
  }
  if (opts.printed === "no") {
    where.OR = [{ currentVersion: null }, { currentVersion: { printedAt: null } }];
  }

  const [total, rows, usedCats] = await Promise.all([
    prisma.recipe.count({ where }),
    prisma.recipe.findMany({
      where,
      orderBy: [{ name: "asc" }],
      skip: opts.skip,
      take: opts.pageSize,
      include: {
        category: { select: { id: true, slug: true, name: true, parentId: true } },
        currentVersion: {
          select: {
            id: true,
            label: true,
            printedAt: true,
            yieldQty: true,
            yieldUnit: true,
            _count: { select: { ingredients: true } },
          },
        },
      },
    }),
    prisma.recipe.groupBy({
      by: ["categoryId"],
      where: { archivedAt: null },
      _count: { id: true },
    }),
  ]);
  const catIds = usedCats.map((c) => c.categoryId);
  const cats = catIds.length
    ? await prisma.category.findMany({
        where: { id: { in: catIds } },
        select: { id: true, slug: true, name: true, sortOrder: true },
        orderBy: { sortOrder: "asc" },
      })
    : [];
  const countBy = new Map(usedCats.map((c) => [c.categoryId, c._count.id]));
  return {
    items: rows.map(serializeRecipeList),
    total,
    categories: cats.map((c) => ({ ...c, count: countBy.get(c.id) ?? 0 })),
  };
}

export async function getRecipe(id: string) {
  const row = await prisma.recipe.findUnique({ where: { id }, include: recipeInclude });
  if (!row || row.archivedAt) throw HttpError.notFound("Recipe not found");
  return serializeRecipe(row);
}

export async function createRecipe(input: {
  name: string;
  categoryId: string;
  version: VersionFields;
}) {
  const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
  if (!category) throw HttpError.badRequest("Pick a category.");
  const name = input.name.trim();
  if (!name) throw HttpError.badRequest("Name the recipe.");

  const created = await prisma.$transaction(async (tx) => {
    const recipe = await tx.recipe.create({
      data: { name, categoryId: input.categoryId },
    });
    const ingredients = await normalizeIngredients(recipe.id, input.version.ingredients);
    const version = await tx.recipeVersion.create({
      data: {
        recipeId: recipe.id,
        label: "v1",
        yieldQty: input.version.yieldQty ?? null,
        yieldUnit: unitOr(input.version.yieldUnit),
        yieldNote: input.version.yieldNote?.trim() || null,
        ingredients: { create: ingredients },
        steps: { create: normalizeSteps(input.version.steps) },
        usageRows: { create: normalizeUsage(input.version.usage) },
      },
    });
    return tx.recipe.update({
      where: { id: recipe.id },
      data: { currentVersionId: version.id },
      include: recipeInclude,
    });
  });
  return serializeRecipe(created);
}

export async function updateRecipe(
  id: string,
  input: {
    name?: string;
    categoryId?: string;
    version?: VersionFields;
  },
) {
  const existing = await prisma.recipe.findUnique({
    where: { id },
    select: { id: true, archivedAt: true, currentVersionId: true },
  });
  if (!existing || existing.archivedAt) throw HttpError.notFound("Recipe not found");
  if (input.categoryId) {
    const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
    if (!category) throw HttpError.badRequest("Pick a category.");
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (input.version && existing.currentVersionId) {
      const ingredients = await normalizeIngredients(id, input.version.ingredients);
      await tx.recipeIngredient.deleteMany({ where: { versionId: existing.currentVersionId } });
      await tx.recipeStep.deleteMany({ where: { versionId: existing.currentVersionId } });
      await tx.recipeUsageRow.deleteMany({ where: { versionId: existing.currentVersionId } });
      await tx.recipeVersion.update({
        where: { id: existing.currentVersionId },
        data: {
          yieldQty: input.version.yieldQty ?? null,
          yieldUnit: unitOr(input.version.yieldUnit),
          yieldNote: input.version.yieldNote?.trim() || null,
          ingredients: { create: ingredients },
          steps: { create: normalizeSteps(input.version.steps) },
          usageRows: { create: normalizeUsage(input.version.usage) },
        },
      });
    }
    return tx.recipe.update({
      where: { id },
      data: {
        name: input.name?.trim() || undefined,
        categoryId: input.categoryId,
      },
      include: recipeInclude,
    });
  });
  return serializeRecipe(updated);
}

export async function cloneVersion(id: string, label?: string) {
  const recipe = await prisma.recipe.findUnique({
    where: { id },
    include: { currentVersion: { include: recipeVersionInclude }, versions: { select: { id: true } } },
  });
  if (!recipe || recipe.archivedAt) throw HttpError.notFound("Recipe not found");
  if (!recipe.currentVersion) throw HttpError.badRequest("This recipe has no current version.");
  const nextLabel = label?.trim() || `v${recipe.versions.length + 1}`;
  const cur = recipe.currentVersion;

  const created = await prisma.$transaction(async (tx) => {
    const version = await tx.recipeVersion.create({
      data: {
        recipeId: id,
        label: nextLabel,
        yieldQty: cur.yieldQty,
        yieldUnit: cur.yieldUnit,
        yieldNote: cur.yieldNote,
        ingredients: {
          create: cur.ingredients.map((l, i) => ({
            name: l.name,
            qty: l.qty,
            unit: l.unit,
            note: l.note,
            sortOrder: i,
            buyItemId: l.buyItemId,
            componentRecipeId: l.componentRecipeId,
          })),
        },
        steps: {
          create: cur.steps.map((s, i) => ({ text: s.text, sortOrder: i })),
        },
        usageRows: {
          create: cur.usageRows.map((u, i) => ({
            axis1: u.axis1,
            axis2: u.axis2,
            qty: u.qty,
            unit: u.unit,
            sortOrder: i,
          })),
        },
      },
    });
    return tx.recipe.update({
      where: { id },
      data: { currentVersionId: version.id },
      include: recipeInclude,
    });
  });
  return serializeRecipe(created);
}

export async function setCurrentVersion(id: string, versionId: string) {
  const version = await prisma.recipeVersion.findFirst({
    where: { id: versionId, recipeId: id },
  });
  if (!version) throw HttpError.notFound("Version not found");
  const updated = await prisma.recipe.update({
    where: { id },
    data: { currentVersionId: versionId },
    include: recipeInclude,
  });
  if (updated.archivedAt) throw HttpError.notFound("Recipe not found");
  return serializeRecipe(updated);
}

export async function archiveRecipe(id: string) {
  const existing = await prisma.recipe.findUnique({ where: { id } });
  if (!existing || existing.archivedAt) throw HttpError.notFound("Recipe not found");
  await prisma.recipe.update({ where: { id }, data: { archivedAt: new Date() } });
  return { ok: true };
}

export async function markVersionsPrinted(versionIds: string[]) {
  if (versionIds.length === 0) return;
  await prisma.recipeVersion.updateMany({
    where: { id: { in: versionIds } },
    data: { printedAt: new Date() },
  });
}

export async function loadVersionsForPrint(opts: { recipeIds?: string[]; versionIds?: string[] }) {
  const ids = new Set(opts.versionIds ?? []);
  if (opts.recipeIds?.length) {
    const recipes = await prisma.recipe.findMany({
      where: { id: { in: opts.recipeIds }, archivedAt: null },
      select: { currentVersionId: true },
    });
    for (const r of recipes) {
      if (r.currentVersionId) ids.add(r.currentVersionId);
    }
  }
  if (ids.size === 0) throw HttpError.badRequest("Pick at least one recipe.");
  const versions = await prisma.recipeVersion.findMany({
    where: { id: { in: [...ids] } },
    include: {
      ...recipeVersionInclude,
      recipe: {
        include: { category: { select: { id: true, slug: true, name: true, parentId: true } } },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  if (versions.length === 0) throw HttpError.badRequest("Pick at least one recipe.");
  return versions;
}
