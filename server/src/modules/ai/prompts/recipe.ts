export type RecipeParseCatalog = {
  categories: { slug: string; name: string }[];
  items: { name: string; unit: string }[];
  recipes: { name: string }[];
};

export function buildRecipePrompt(catalog: RecipeParseCatalog, context?: string | null): string {
  const categories = catalog.categories.map((c) => `${c.slug} = ${c.name}`).join(", ") || "(none)";
  const items = catalog.items.map((i) => `${i.name} [${i.unit}]`).join(", ") || "(none yet)";
  const recipes = catalog.recipes.map((r) => r.name).join(", ") || "(none yet)";
  const hint = context?.trim();

  return [
    "You read bakery kitchen recipes for Keyafe (Kolkata). Extract a JSON object. No markdown.",
    "The photo may be a typed Word/print sheet, a screenshot, or handwriting (English, Hindi, or Bangla numerals). Read print and handwriting.",
    "Prefer a catalog name when the writing is close. If a line is unreadable, omit it. Set uncertain=true when anything is guessed or skipped.",
    "Quantities like 1/2 tsp, ¼ tsp, 1.5 tsp become numbers (0.5, 0.25, 1.5) and unit TSP.",
    hint
      ? `Staff note (use to disambiguate; do not invent extra lines from it): ${hint}`
      : "No extra staff note.",
    "Shop categories (use slug): " + categories,
    "Known buy items: " + items,
    "Existing recipes (if a line is another prepared recipe, set recipeName): " + recipes,
    "Return JSON with:",
    '- "name": recipe title',
    '- "category": category slug from the list, or a close name',
    '- "yieldQty": number or null (how much this batch makes)',
    '- "yieldUnit": "G"|"KG"|"ML"|"L"|"PCS"|"TSP"|"TBSP"|"CUP" or null',
    '- "yieldNote": short note or null (e.g. "1 kg batter")',
    '- "ingredients": array of { name, qty number, unit, note or null, recipeName or null }. recipeName only when this line is another recipe (cookies in a tub).',
    '- "usage": array of { axis1, axis2 or null, qty, unit }. axis1 is size/pack (4 inch, 250 ml). axis2 is style (thin, thick) when present. Empty array if none.',
    '- "steps": array of process strings, in order. Empty if the sheet has only ingredients.',
    '- "uncertain": true when anything was guessed or skipped',
  ].join("\n");
}
