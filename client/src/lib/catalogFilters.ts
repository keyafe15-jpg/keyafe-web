import type { ProductCard } from "@/hooks/useProducts";

export type CatalogSort = "featured" | "price_asc" | "price_desc";

export type CatalogFilterState = {
  flavor: string;
  minPrice: string;
  maxPrice: string;
  sort: CatalogSort;
};

export const EMPTY_CATALOG_FILTERS: CatalogFilterState = {
  flavor: "",
  minPrice: "",
  maxPrice: "",
  sort: "featured",
};

/** Storefront price slider bounds (₹). Full range = no price filter in the URL. */
export const CATALOG_PRICE_FLOOR = 0;
export const CATALOG_PRICE_CEILING = 5000;
export const CATALOG_PRICE_STEP = 50;

const FILTER_KEYS = ["flavor", "minPrice", "maxPrice", "sort"] as const;

/** Read catalog filter fields from a URLSearchParams (ignores unrelated keys like q / cat). */
export function catalogFiltersFromSearchParams(params: URLSearchParams): CatalogFilterState {
  const sortRaw = params.get("sort");
  const sort: CatalogSort =
    sortRaw === "price_asc" || sortRaw === "price_desc" || sortRaw === "featured"
      ? sortRaw
      : "featured";

  return {
    flavor: params.get("flavor")?.trim() ?? "",
    minPrice: params.get("minPrice")?.trim() ?? "",
    maxPrice: params.get("maxPrice")?.trim() ?? "",
    sort,
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
      (filters.sort && filters.sort !== "featured"),
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
