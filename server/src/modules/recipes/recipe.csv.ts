import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";
import { normalizeItemName } from "../finance/books.shared.js";
import {
  mapRecipeUnit,
  parseRecipeQty,
  RECIPE_UNITS,
  type RecipeUnitKey,
} from "./recipe.shared.js";
import { createRecipe, type IngredientInput, type UsageInput } from "./recipe.service.js";

export type CsvRecipeRow = {
  name: string;
  category: string;
  yieldQty: number | null;
  yieldUnit: RecipeUnitKey | null;
  yieldNote: string | null;
  ingredients: {
    qty: number;
    unit: RecipeUnitKey;
    name: string;
    note: string | null;
    nested: boolean;
  }[];
  usage: UsageInput[];
  steps: string[];
};

export type RecipeImportResult = {
  created: number;
  skipped: number;
  errors: { name: string; message: string }[];
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let i = 0;
  let inQuotes = false;
  const s = text.replace(/^\uFEFF/, "");
  while (i < s.length) {
    const c = s[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cell += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === ",") {
      row.push(cell);
      cell = "";
      i += 1;
      continue;
    }
    if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i += 1;
      row.push(cell);
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
      cell = "";
      i += 1;
      continue;
    }
    cell += c;
    i += 1;
  }
  if (cell.length || row.length) {
    row.push(cell);
    if (row.some((x) => x.trim())) rows.push(row);
  }
  return rows;
}

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function splitJoined(raw: string) {
  return raw
    .split(/\s*\|\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function parseUnit(raw: string): RecipeUnitKey | null {
  const u = raw.trim().toUpperCase();
  if ((RECIPE_UNITS as readonly string[]).includes(u)) return u as RecipeUnitKey;
  return mapRecipeUnit(raw);
}

export function parseRecipeCsv(text: string): CsvRecipeRow[] {
  const table = parseCsv(text);
  if (table.length < 2) throw HttpError.badRequest("CSV has no recipe rows.");
  const header = table[0]!.map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const iName = col("name");
  const iCat = col("category");
  const iYieldQty = col("yieldqty");
  const iYieldUnit = col("yieldunit");
  const iYieldNote = col("yieldnote");
  const iIngs = col("ingredients");
  const iUsage = col("usage");
  const iSteps = col("steps");
  if (iName < 0 || iCat < 0 || iIngs < 0) {
    throw HttpError.badRequest("CSV needs name, category, and ingredients columns.");
  }

  const out: CsvRecipeRow[] = [];
  for (const cells of table.slice(1)) {
    const name = (cells[iName] ?? "").trim();
    if (!name) continue;
    const ingredients = splitJoined(cells[iIngs] ?? "").flatMap((part) => {
      const bits = part.split(";");
      const qty = parseRecipeQty(bits[0]);
      const unit = parseUnit(bits[1] ?? "");
      const ingName = (bits[2] ?? "").trim();
      if (!qty || !unit || !ingName) return [];
      const note = (bits[3] ?? "").trim() || null;
      const nested = (bits[4] ?? "").trim().toLowerCase() === "recipe";
      return [{ qty, unit, name: ingName, note, nested }];
    });
    if (ingredients.length === 0) continue;

    const usage = splitJoined(cells[iUsage] ?? "").flatMap((part) => {
      const bits = part.split(";");
      const axis1 = (bits[0] ?? "").trim();
      const qty = parseRecipeQty(bits[2] ?? bits[1]);
      const unit = parseUnit(bits[3] ?? bits[2] ?? "");
      if (!axis1 || !qty || !unit) return [];
      return [{ axis1, axis2: (bits[1] ?? "").trim() || null, qty, unit }];
    });

    out.push({
      name,
      category: (cells[iCat] ?? "").trim(),
      yieldQty: iYieldQty >= 0 ? parseRecipeQty(cells[iYieldQty]) : null,
      yieldUnit: iYieldUnit >= 0 ? parseUnit(cells[iYieldUnit] ?? "") : null,
      yieldNote: iYieldNote >= 0 ? (cells[iYieldNote] ?? "").trim() || null : null,
      ingredients,
      usage,
      steps: iSteps >= 0 ? splitJoined(cells[iSteps] ?? "") : [],
    });
  }
  if (out.length === 0) throw HttpError.badRequest("No usable recipe rows in that CSV.");
  return out;
}

function sortForNesting(rows: CsvRecipeRow[]): CsvRecipeRow[] {
  const names = new Set(rows.map((r) => norm(r.name)));
  const pending = [...rows];
  const done = new Set<string>();
  const out: CsvRecipeRow[] = [];
  while (pending.length) {
    const ready = pending.filter((r) =>
      r.ingredients
        .filter((i) => i.nested)
        .every((i) => !names.has(norm(i.name)) || done.has(norm(i.name))),
    );
    if (ready.length === 0) {
      out.push(...pending);
      break;
    }
    for (const r of ready) {
      out.push(r);
      done.add(norm(r.name));
    }
    for (const r of ready) {
      const idx = pending.indexOf(r);
      if (idx >= 0) pending.splice(idx, 1);
    }
  }
  return out;
}

/** Kitchen folder names that are not shop categories on this store. */
const CATEGORY_ALIASES: Record<string, string> = {
  cakes: "drycakes",
  cookies: "drycakes",
  muffins: "drycakes",
  brownies: "drycakes",
};

async function resolveCategoryId(label: string, cache: Map<string, string>): Promise<string | null> {
  const key = CATEGORY_ALIASES[norm(label)] ?? norm(label);
  const hit = cache.get(key);
  if (hit) return hit;
  const cats = await prisma.category.findMany({
    select: { id: true, name: true, slug: true },
  });
  for (const c of cats) {
    cache.set(norm(c.name), c.id);
    cache.set(norm(c.slug), c.id);
  }
  return cache.get(key) ?? cache.get(CATEGORY_ALIASES[norm(label)] ?? "") ?? null;
}

export async function importRecipesFromCsv(text: string): Promise<RecipeImportResult> {
  const rows = sortForNesting(parseRecipeCsv(text));
  const catCache = new Map<string, string>();
  const created: number[] = [];
  let skipped = 0;
  const errors: { name: string; message: string }[] = [];

  const items = await prisma.buyItem.findMany({
    where: { isActive: true, archivedAt: null },
    select: { id: true, name: true, nameNormalized: true },
  });
  const itemByNorm = new Map(items.map((i) => [i.nameNormalized, i.id]));

  const existing = await prisma.recipe.findMany({
    where: { archivedAt: null },
    select: { id: true, name: true },
  });
  const recipeIdByNorm = new Map(existing.map((r) => [norm(r.name), r.id]));

  for (const row of rows) {
    if (recipeIdByNorm.has(norm(row.name))) {
      skipped += 1;
      continue;
    }
    const categoryId = await resolveCategoryId(row.category, catCache);
    if (!categoryId) {
      errors.push({ name: row.name, message: `No shop category “${row.category}”.` });
      continue;
    }
    const ingredients: IngredientInput[] = [];
    for (const line of row.ingredients) {
      if (line.nested) {
        const childId = recipeIdByNorm.get(norm(line.name));
        if (!childId) {
          ingredients.push({
            name: line.name,
            qty: line.qty,
            unit: line.unit,
            note: line.note,
          });
          continue;
        }
        ingredients.push({
          name: line.name,
          qty: line.qty,
          unit: line.unit,
          note: line.note,
          componentRecipeId: childId,
        });
        continue;
      }
      ingredients.push({
        name: line.name,
        qty: line.qty,
        unit: line.unit,
        note: line.note,
        buyItemId: itemByNorm.get(normalizeItemName(line.name)) ?? null,
      });
    }
    try {
      const createdRow = await createRecipe({
        name: row.name,
        categoryId,
        version: {
          yieldQty: row.yieldQty,
          yieldUnit: row.yieldQty ? row.yieldUnit : null,
          yieldNote: row.yieldNote,
          ingredients,
          steps: row.steps,
          usage: row.usage,
        },
      });
      recipeIdByNorm.set(norm(createdRow.name), createdRow.id);
      created.push(1);
    } catch (err) {
      errors.push({
        name: row.name,
        message: err instanceof Error ? err.message : "Could not save",
      });
    }
  }

  return { created: created.length, skipped, errors };
}
