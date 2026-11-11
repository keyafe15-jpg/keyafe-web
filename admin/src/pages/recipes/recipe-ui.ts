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

const KITCHEN_FRACTIONS: [number, string][] = [
  [0.125, "1/8"],
  [0.25, "1/4"],
  [1 / 3, "1/3"],
  [0.375, "3/8"],
  [0.5, "1/2"],
  [0.625, "5/8"],
  [2 / 3, "2/3"],
  [0.75, "3/4"],
  [0.875, "7/8"],
];

/** 0.5 → 1/2, 1.5 → 1 1/2. Staff read slash fractions, not decimals. */
export function kitchenQtyLabel(qty: number): string {
  const n = Math.round(qty * 1000) / 1000;
  const match = (x: number) => KITCHEN_FRACTIONS.find(([v]) => Math.abs(x - v) < 0.0005)?.[1];
  const whole = Math.floor(n + 1e-9);
  const frac = n - whole;
  if (whole > 0 && frac > 0.0005) {
    const f = match(frac);
    if (f) return `${whole} ${f}`;
  }
  return match(n) ?? String(n);
}

export function formatRecipeQty(qty: number, unit: string) {
  return `${kitchenQtyLabel(qty)} ${unitLabel(unit)}`;
}

export function formatRecipeQtyCell(qty: number | null | undefined, unit: string, factor = 1) {
  if (qty == null || qty <= 0) return "";
  return formatRecipeQty(scaleQty(qty, factor), unit);
}

export function scaleQty(qty: number, factor: number) {
  return Math.round(qty * factor * 1000) / 1000;
}

export type PastedRecipeLine = {
  name: string;
  qty: number;
  unit: RecipeUnit;
  note: string | null;
};

const PASTE_UNIT =
  "tablespoons?|tbsps?|teaspoons?|tsps?|cups?|kilograms?|kilos?|kg|millilitres?|milliliters?|ml|litres?|liters?|ltr|grams?|gms?|gm|pcs|pieces?|pc|nos|g|l";
const PASTE_QTY = `(?:\\d+\\s*)?[¼½¾⅓⅔⅛⅜⅝⅞]|\\d+\\s+\\d+\\s*/\\s*\\d+|\\d+\\s*/\\s*\\d+|\\d+(?:\\.\\d+)?`;
const SKIP_PASTE_LINE =
  /^(ingredients?|method|process|steps?|directions?|procedure|notes?|recipe)\s*:?\s*$/i;

function cleanPastedName(raw: string) {
  return raw
    .replace(/^[-*•]+\s*/, "")
    .replace(/^\d+[.)]\s*/, "")
    .replace(/\s+/g, " ")
    .replace(/[–—:|,-]+\s*$/g, "")
    .trim();
}

function cleanPastedNote(raw: string) {
  const t = raw.replace(/^[–—:|()[\]\s]+/, "").replace(/[)\]\s]+$/, "").trim();
  return t || null;
}

function lineFromParts(nameRaw: string, qtyRaw: string, unitRaw: string, noteRaw: string): PastedRecipeLine | null {
  const name = cleanPastedName(nameRaw);
  const qty = parseRecipeQty(qtyRaw);
  if (!name || !qty) return null;
  return {
    name,
    qty,
    unit: unitFromQtyText(unitRaw) ?? unitFromQtyText(`${qtyRaw}${unitRaw}`) ?? "G",
    note: cleanPastedNote(noteRaw),
  };
}

/** One kitchen line: "maida - 100g", "sugar 50g", "100 g butter", "1/2 tsp vanilla". */
export function parsePastedRecipeLine(raw: string): PastedRecipeLine | null {
  let s = raw.replace(/\s+/g, " ").trim();
  if (!s || SKIP_PASTE_LINE.test(s)) return null;
  s = s.replace(/^[-*•]+\s*/, "").replace(/^\d+[.)]\s*/, "");

  const qtyUnit = `(${PASTE_QTY})\\s*(${PASTE_UNIT})(?![a-z])`;
  const nameThenQty = new RegExp(`^(.+?)\\s*[-–—:|]\\s*${qtyUnit}(.*)$`, "i");
  const qtyThenName = new RegExp(`^${qtyUnit}\\s+(.+)$`, "i");
  const nameSpaceQty = new RegExp(`^(.+?)\\s+${qtyUnit}(.*)$`, "i");

  let m = s.match(nameThenQty);
  if (m) return lineFromParts(m[1] ?? "", m[2] ?? "", m[3] ?? "", m[4] ?? "");
  m = s.match(qtyThenName);
  if (m) return lineFromParts(m[3] ?? "", m[1] ?? "", m[2] ?? "", "");
  m = s.match(nameSpaceQty);
  if (m) return lineFromParts(m[1] ?? "", m[2] ?? "", m[3] ?? "", m[4] ?? "");

  const qtyFirst = s.match(new RegExp(`^(${PASTE_QTY})\\s+(.+)$`, "i"));
  if (qtyFirst) {
    const row = lineFromParts(qtyFirst[2] ?? "", qtyFirst[1] ?? "", "pcs", "");
    if (row) return row;
  }
  const nameThenBareQty = s.match(new RegExp(`^(.+?)\\s*[-–—:|]?\\s*(${PASTE_QTY})\\s*$`, "i"));
  if (nameThenBareQty) return lineFromParts(nameThenBareQty[1] ?? "", nameThenBareQty[2] ?? "", "g", "");
  return null;
}

export function parsePastedRecipeText(text: string): { ingredients: PastedRecipeLine[]; skipped: number } {
  const ingredients: PastedRecipeLine[] = [];
  let skipped = 0;
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const row = parsePastedRecipeLine(raw);
    if (!row) {
      skipped += 1;
      continue;
    }
    ingredients.push(row);
  }
  return { ingredients, skipped };
}
