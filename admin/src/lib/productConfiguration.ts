import type {
  AdminOptionGroup,
  AdminProductDetail,
  AdminProductVariant,
  ProductOptionInput,
} from "@/hooks/useAdminProducts";

/** Customer-visible price for an option — respects group priceMode. */
export function optionUnitPrice(
  basePrice: number,
  option: Pick<ProductOptionInput, "price">,
  priceMode: AdminOptionGroup["priceMode"],
): number {
  const optionPrice = Number(option.price);
  return priceMode === "ABSOLUTE" ? optionPrice : basePrice + optionPrice;
}

export function formatOptionSelectLabel(
  option: ProductOptionInput,
  basePrice: number,
  priceMode: AdminOptionGroup["priceMode"],
): string {
  return `${option.label} · ₹${optionUnitPrice(basePrice, option, priceMode).toFixed(0)}`;
}

export function activeOptions(options: ProductOptionInput[]): ProductOptionInput[] {
  return options.filter((o) => o.isActive !== false && o.id);
}

export function getSizeOptionGroup(
  detail: AdminProductDetail | undefined,
): AdminOptionGroup | undefined {
  if (!detail) return undefined;
  const fromGroups = detail.optionGroups?.find((g) => g.key === "size");
  if (fromGroups && fromGroups.options.length > 0) return fromGroups;
  const legacy = activeOptions(detail.sizeOptions ?? []);
  if (legacy.length === 0) return undefined;
  return {
    id: "size",
    key: "size",
    label: "Size",
    priceMode: "ABSOLUTE",
    selectionType: "SINGLE",
    isRequired: true,
    sortOrder: 0,
    options: legacy,
  };
}

export function availableFixedSkus(
  detail: AdminProductDetail | undefined,
): AdminProductVariant[] {
  return (detail?.fixedVariants ?? []).filter((v) => v.isAvailable);
}

/** 500g = 1 pound = 1× basePrice on the storefront. */
export const CAKE_BASE_GRAMS = 500;

export function parseCustomPounds(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function customPoundsToGrams(pounds: number): number {
  return Math.round(pounds * CAKE_BASE_GRAMS);
}

export function isGramsWithinBounds(
  grams: number,
  minGrams: number | null | undefined,
  maxGrams: number | null | undefined,
): boolean {
  if (minGrams != null && grams < minGrams) return false;
  if (maxGrams != null && grams > maxGrams) return false;
  return true;
}

export function formatCustomPoundLabel(pounds: number): string {
  const rounded = Math.round(pounds * 10) / 10;
  const text = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(1);
  return `${text} lb (custom)`;
}

export function computeCakeUnitPrice(
  basePrice: number,
  grams: number,
  flavourAdditional = 0,
  flavourPricedIn = false,
): number {
  const multiplier = grams / CAKE_BASE_GRAMS;
  const delta = flavourPricedIn ? 0 : flavourAdditional;
  return Math.round((basePrice + delta) * multiplier);
}

export function cakeSizeSelectLabel(
  sizeLabel: string,
  grams: number,
  basePrice: number,
  flavourAdditional = 0,
  flavourPricedIn = false,
): string {
  const price = computeCakeUnitPrice(
    basePrice,
    grams,
    flavourAdditional,
    flavourPricedIn,
  );
  return `${sizeLabel} · ₹${price.toFixed(0)}`;
}
