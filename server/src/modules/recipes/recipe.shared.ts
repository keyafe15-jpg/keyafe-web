import type { RecipeUnit } from "@prisma/client";
import { HttpError } from "../../utils/httpError.js";
import type { AuthenticatedRequest } from "../../middleware/auth.js";
import { staffHasPermission } from "../../middleware/auth.js";

export const RECIPE_UNITS = ["G", "KG", "ML", "L", "PCS", "TSP", "TBSP", "CUP"] as const;
export type RecipeUnitKey = (typeof RECIPE_UNITS)[number];

export function pageParams(query: { page?: unknown; pageSize?: unknown }) {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
  return { page, pageSize, skip: (page - 1) * pageSize };
}

export function pageJson<T>(items: T[], total: number, page: number, pageSize: number) {
  return {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export function qtyNum(n: number | string | { toString(): string }): number {
  const v = Number(n);
  return Number.isFinite(v) ? Math.round(v * 1000) / 1000 : 0;
}

const FRACTION_CHARS: Record<string, number> = {
  "¼": 0.25,
  "½": 0.5,
  "¾": 0.75,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "⅛": 0.125,
  "⅜": 0.375,
  "⅝": 0.625,
  "⅞": 0.875,
};

/** 1/2, ¼, 1½, "0.5 tsp" — Number("1/2") is NaN. */
export function parseRecipeQty(raw: unknown): number | null {
  if (typeof raw === "number") {
    return Number.isFinite(raw) && raw > 0 ? Math.round(raw * 1000) / 1000 : null;
  }
  if (raw == null) return null;
  let s = String(raw).trim().replace(/,/g, "");
  if (!s) return null;
  s = s.replace(/(\d+)\s*([¼½¾⅓⅔⅛⅜⅝⅞])/g, (_, d: string, ch: string) =>
    String(Number(d) + (FRACTION_CHARS[ch] ?? 0)),
  );
  for (const [ch, n] of Object.entries(FRACTION_CHARS)) {
    if (s.includes(ch)) s = s.split(ch).join(String(n));
  }
  const mixed = s.match(/(\d+(?:\.\d+)?)\s+(\d+)\s*\/\s*(\d+)/);
  if (mixed) {
    const v = Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
    return v > 0 ? Math.round(v * 1000) / 1000 : null;
  }
  const frac = s.match(/(\d+)\s*\/\s*(\d+)/);
  if (frac) {
    const v = Number(frac[1]) / Number(frac[2]);
    return v > 0 ? Math.round(v * 1000) / 1000 : null;
  }
  const n = Number(s.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 1000) / 1000 : null;
}

export function unitFromQtyText(raw: unknown): RecipeUnit | null {
  const s = String(raw ?? "")
    .toLowerCase()
    .replace(/[.\s]+/g, "");
  if (!s) return null;
  if (s.includes("tbsp") || s.includes("tablespoon")) return "TBSP";
  if (s.includes("tsp") || s.includes("teaspoon")) return "TSP";
  if (s.includes("cup")) return "CUP";
  if (s.includes("kg") || s.includes("kilo")) return "KG";
  if (s.includes("ml") || s.includes("millilitre") || s.includes("milliliter")) return "ML";
  if (s.includes("ltr") || s.includes("litre") || s.includes("liter")) return "L";
  if (s.includes("pcs") || s.includes("piece") || s.includes("nos")) return "PCS";
  if (/(?:^|[^a-z])(?:g|gm|gms|gram|grams)(?:[^a-z]|$)/.test(s)) return "G";
  return null;
}

export function requireRecipeWrite(req: AuthenticatedRequest) {
  const staff = req.staff;
  if (!staff || !staffHasPermission(staff, "recipes.write")) {
    throw HttpError.forbidden("You don't have permission to do this");
  }
  return staff;
}

export function mapRecipeUnit(raw: unknown): RecipeUnit {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[.\s]+/g, "");
  if (s === "kg" || s === "kilo" || s === "kilos" || s === "kilogram") return "KG";
  if (s === "g" || s === "gm" || s === "gms" || s === "gram" || s === "grams") return "G";
  if (s === "l" || s === "lt" || s === "ltr" || s === "litre" || s === "liter") return "L";
  if (s === "ml" || s === "millilitre" || s === "milliliter") return "ML";
  if (
    s === "tsp" ||
    s === "tsps" ||
    s === "teaspoon" ||
    s === "teaspoons" ||
    s === "1/2tsp" ||
    s === "1/4tsp" ||
    s === "1/8tsp"
  )
    return "TSP";
  if (s === "tbsp" || s === "tbsps" || s === "tablespoon" || s === "tablespoons") return "TBSP";
  if (s === "cup" || s === "cups") return "CUP";
  if (s === "pcs" || s === "pc" || s === "piece" || s === "pieces" || s === "nos") return "PCS";
  const fromText = unitFromQtyText(raw);
  if (fromText) return fromText;
  if ((RECIPE_UNITS as readonly string[]).includes(String(raw ?? "").toUpperCase())) {
    return String(raw).toUpperCase() as RecipeUnit;
  }
  return "G";
}

export function unitLabel(unit: string) {
  if (unit === "KG") return "kg";
  if (unit === "G") return "g";
  if (unit === "L") return "L";
  if (unit === "ML") return "ml";
  if (unit === "PCS") return "pcs";
  if (unit === "TSP") return "tsp";
  if (unit === "TBSP") return "tbsp";
  if (unit === "CUP") return "cup";
  return unit.toLowerCase();
}

export const recipeVersionInclude = {
  ingredients: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      buyItem: { select: { id: true, name: true } },
      componentRecipe: { select: { id: true, name: true } },
    },
  },
  steps: { orderBy: { sortOrder: "asc" as const } },
  usageRows: { orderBy: { sortOrder: "asc" as const } },
};

export const recipeInclude = {
  category: { select: { id: true, slug: true, name: true, parentId: true } },
  currentVersion: { include: recipeVersionInclude },
  versions: {
    orderBy: { createdAt: "desc" as const },
    include: recipeVersionInclude,
  },
};
