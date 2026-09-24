import type { ProductCard } from "@/hooks/useProducts";

export type CatalogSort = "featured" | "price_asc" | "price_desc";
export type CatalogDiet = "" | "veg" | "nonveg";
export type CatalogHeat = "" | "spicy" | "mild";

export type CatalogFilterState = {
  flavor: string;
  minPrice: string;
  maxPrice: string;
  sort: CatalogSort;
  noCream: boolean;
  fixedDesign: boolean;
  diet: CatalogDiet;
  heat: CatalogHeat;
};

export const EMPTY_CATALOG_FILTERS: CatalogFilterState = {
  flavor: "",
  minPrice: "",
  maxPrice: "",
  sort: "featured",
  noCream: false,
  fixedDesign: false,
  diet: "",
  heat: "",
};

/** Storefront price slider bounds (₹). Full range = no price filter in the URL. */
export const CATALOG_PRICE_FLOOR = 0;
export const CATALOG_PRICE_CEILING = 5000;
export const CATALOG_PRICE_STEP = 50;

export const NO_CREAM_CATEGORY_SLUG = "no-cream-cakes";

const FILTER_KEYS = [
  "flavor",
  "minPrice",
  "maxPrice",
  "sort",
  "noCream",
  "fixed",
  "diet",
  "heat",
] as const;

/** Read catalog filter fields from a URLSearchParams (ignores unrelated keys like q / cat). */
export function catalogFiltersFromSearchParams(params: URLSearchParams): CatalogFilterState {
  const sortRaw = params.get("sort");
  const sort: CatalogSort =
    sortRaw === "price_asc" || sortRaw === "price_desc" || sortRaw === "featured"
      ? sortRaw
      : "featured";

  const dietRaw = params.get("diet");
  const diet: CatalogDiet = dietRaw === "veg" || dietRaw === "nonveg" ? dietRaw : "";

  const heatRaw = params.get("heat");
  const heat: CatalogHeat = heatRaw === "spicy" || heatRaw === "mild" ? heatRaw : "";

  return {
    flavor: params.get("flavor")?.trim() ?? "",
    minPrice: params.get("minPrice")?.trim() ?? "",
    maxPrice: params.get("maxPrice")?.trim() ?? "",
    sort,
    noCream: params.get("noCream") === "1",
    fixedDesign: params.get("fixed") === "1",
    diet,
    heat,
  };
}

/** Merge filter values into an existing URLSearchParams (preserves q / cat / etc.). */
export function writeCatalogFiltersToSearchParams(
  params: URLSearchParams,
  filters: CatalogFilterState,
) {
  for (const key of FILTER_KEYS) {
    params.delete(key);
  }
  if (filters.flavor) params.set("flavor", filters.flavor);
  if (filters.minPrice) params.set("minPrice", filters.minPrice);
  if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
  if (filters.sort && filters.sort !== "featured") params.set("sort", filters.sort);
  if (filters.noCream) params.set("noCream", "1");
  if (filters.fixedDesign) params.set("fixed", "1");
  if (filters.diet) params.set("diet", filters.diet);
  if (filters.heat) params.set("heat", filters.heat);
}

/** Append as `&flavor=…&sort=…` for API calls (leading & when non-empty). */
export function catalogFiltersToQuerySuffix(filters: CatalogFilterState): string {
  const p = new URLSearchParams();
  writeCatalogFiltersToSearchParams(p, filters);
  const s = p.toString();
  return s ? `&${s}` : "";
}

export function catalogFiltersAreActive(filters: CatalogFilterState): boolean {
  return Boolean(
    filters.flavor ||
      filters.minPrice ||
      filters.maxPrice ||
      (filters.sort && filters.sort !== "featured") ||
      filters.noCream ||
      filters.fixedDesign ||
      filters.diet ||
      filters.heat,
  );
}

/** Client-side filter/sort for non-paginated product lists (same-day, healthy, pan-India). */
export function applyCatalogFilters(
  products: ProductCard[],
  filters: CatalogFilterState,
): ProductCard[] {
  let items = products;

  if (filters.flavor) {
    items = items.filter((p) => (p.flavors ?? []).some((f) => f.slug === filters.flavor));
  }

  if (filters.noCream) {
    items = items.filter((p) =>
      p.categories.some((c) => c.slug === NO_CREAM_CATEGORY_SLUG),
    );
  }

  if (filters.fixedDesign) {
    items = items.filter((p) => p.isCustomizable === false);
  }

  if (filters.diet === "veg") {
    items = items.filter((p) => p.isEggless);
  } else if (filters.diet === "nonveg") {
    items = items.filter((p) => !p.isEggless);
  }

  if (filters.heat === "spicy") {
    items = items.filter((p) => p.isSpicy);
  } else if (filters.heat === "mild") {
    items = items.filter((p) => !p.isSpicy);
  }

  const min = filters.minPrice ? Number(filters.minPrice) : NaN;
  const max = filters.maxPrice ? Number(filters.maxPrice) : NaN;
  if (Number.isFinite(min)) {
    items = items.filter((p) => Number(p.startingPrice) >= min);
  }
  if (Number.isFinite(max)) {
    items = items.filter((p) => Number(p.startingPrice) <= max);
  }

  if (filters.sort === "price_asc") {
    items = [...items].sort((a, b) => Number(a.startingPrice) - Number(b.startingPrice));
  } else if (filters.sort === "price_desc") {
    items = [...items].sort((a, b) => Number(b.startingPrice) - Number(a.startingPrice));
  }

  return items;
}
