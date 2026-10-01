import { applyFactor, formatINR } from "@keyafe/shared";
import type { AdminProduct } from "@/hooks/useAdminProducts";
import type { CategoryNode } from "@/hooks/useCategories";
import type { SearchableSelectOption } from "@/components/form/SearchableSelect";

/** Label for the product SearchableSelect — hints when option-group sizes exist. */
export function formatCatalogProductLabel(p: AdminProduct): string {
  const price = formatINR(applyFactor(p.priceMin, p.priceFactor));
  const off = p.priceFactor ? ` (−${Math.round((1 - p.priceFactor) * 100)}%)` : "";
  return p.priceMin !== p.priceMax
    ? `${p.name} · from ${price}${off}`
    : `${p.name} · ${price}${off}`;
}

export const UNCATEGORISED = "__uncategorised";

export interface CatalogPicker {
  categoryOptions: SearchableSelectOption[];
  productOptions: (categoryId: string) => SearchableSelectOption[];
  inCategory: (productId: string, categoryId: string) => boolean;
}

/**
 * Category + product options for the catalog item picker. A parent category
 * includes products linked to any of its sub-categories; with no category
 * picked, products are grouped under their top-level category.
 */
export function buildCatalogPicker(products: AdminProduct[], tree: CategoryNode[]): CatalogPicker {
  const topLevelOf = new Map<string, { node: CategoryNode; rank: number }>();
  tree.forEach((parent, rank) => {
    topLevelOf.set(parent.id, { node: parent, rank });
    for (const child of parent.children) topLevelOf.set(child.id, { node: parent, rank });
  });

  const matches = (p: AdminProduct, categoryId: string) => {
    if (!categoryId) return true;
    if (categoryId === UNCATEGORISED) return p.categories.length === 0;
    return p.categories.some(
      (c) => c.id === categoryId || topLevelOf.get(c.id)?.node.id === categoryId,
    );
  };
  const countIn = (categoryId: string) => products.filter((p) => matches(p, categoryId)).length;

  const categoryOptions: SearchableSelectOption[] = [];
  for (const parent of tree) {
    const total = countIn(parent.id);
    if (!total) continue;
    categoryOptions.push({ value: parent.id, label: `${parent.name} (${total})` });
    for (const child of parent.children) {
      const n = countIn(child.id);
      if (n) {
        categoryOptions.push({
          value: child.id,
          label: `${parent.name} › ${child.name} (${n})`,
          keywords: child.name,
        });
      }
    }
  }
  const uncategorised = countIn(UNCATEGORISED);
  if (uncategorised) {
    categoryOptions.push({ value: UNCATEGORISED, label: `Uncategorised (${uncategorised})` });
  }

  const ranked = products
    .map((p) => {
      const top = p.categories.map((c) => topLevelOf.get(c.id)).find(Boolean);
      return {
        p,
        group: top?.node.name ?? p.categories[0]?.name ?? "Uncategorised",
        rank: top?.rank ?? tree.length,
      };
    })
    .sort(
      (a, b) =>
        a.rank - b.rank || a.group.localeCompare(b.group) || a.p.name.localeCompare(b.p.name),
    );

  const byId = new Map(products.map((p) => [p.id, p]));

  return {
    categoryOptions,
    productOptions: (categoryId) =>
      ranked
        .filter(({ p }) => matches(p, categoryId))
        .map(({ p, group }) => ({
          value: p.id,
          label: formatCatalogProductLabel(p),
          keywords: `${p.name} ${p.categories.map((c) => c.name).join(" ")}`,
          group: categoryId ? undefined : group,
          image: p.images[0] ?? null,
        })),
    inCategory: (productId, categoryId) => {
      const p = byId.get(productId);
      return p ? matches(p, categoryId) : false;
    },
  };
}

/** Clears configuration state when the catalog product changes. */
export function resetCatalogProductPick(): {
  productName: string;
  unitPrice: string;
  sizeLabel: string;
  sizeGrams: string;
  flavourId: string;
  variantId: string;
  sizeOptionId: string;
  crustOptionId: string;
  crustLabel: string;
  cakeSizeId: string;
  customPounds: string;
  toppingSelections: string[];
  addonSelections: string[];
} {
  return {
    productName: "",
    unitPrice: "",
    sizeLabel: "",
    sizeGrams: "",
    flavourId: "",
    variantId: "",
    sizeOptionId: "",
    crustOptionId: "",
    crustLabel: "",
    cakeSizeId: "",
    customPounds: "",
    toppingSelections: [],
    addonSelections: [],
  };
}
