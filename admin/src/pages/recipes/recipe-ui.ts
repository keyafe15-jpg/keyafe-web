export const RECIPE_UNITS = ["G", "KG", "ML", "L", "PCS", "TSP", "TBSP", "CUP"] as const;
export type RecipeUnit = (typeof RECIPE_UNITS)[number];

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

/** 1/2, ¼, 1½, "0.5 tsp" — kitchen qty, not Number() which treats 1/2 as NaN. */
export function parseRecipeQty(raw: string | number | null | undefined): number | null {
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

export function unitFromQtyText(raw: string): RecipeUnit | null {
  const s = raw.toLowerCase().replace(/[.\s]+/g, "");
  if (!s) return null;
  if (s.includes("tbsp") || s.includes("tablespoon")) return "TBSP";
  if (s.includes("tsp") || s.includes("teaspoon")) return "TSP";
  if (s.includes("cup")) return "CUP";
  if (/(?:^|[^a-z])kg/.test(s) || s.includes("kilo")) return "KG";
  if (s.includes("ml") || s.includes("millilitre") || s.includes("milliliter")) return "ML";
  if (/(?:^|[^a-z])l(?:tr|itre|iter|t)?$/.test(s) || s.endsWith("ltr")) return "L";
  if (s.includes("pcs") || s.includes("piece") || s.includes("nos")) return "PCS";
  if (/(?:^|[^a-z])(?:g|gm|gms|gram|grams)(?:[^a-z]|$)/.test(s)) return "G";
  return null;
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

export function formatRecipeQty(qty: number, unit: string) {
  const n = Math.round(qty * 1000) / 1000;
  const shown = n === 0.25 ? "¼" : n === 0.5 ? "½" : n === 0.75 ? "¾" : String(n);
  return `${shown} ${unitLabel(unit)}`;
}

export function scaleQty(qty: number, factor: number) {
  return Math.round(qty * factor * 1000) / 1000;
}
