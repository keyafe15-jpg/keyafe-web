import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  type CatalogFilterState,
  EMPTY_CATALOG_FILTERS,
  catalogFiltersToQuerySuffix,
} from "@/lib/catalogFilters";

export interface ProductCard {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  basePrice: string;
  // Minimum customer-visible price. For variant-priced products (pizzas etc.)
  // this reflects the cheapest size; for cakes it equals basePrice.
  startingPrice: string;
  template: "CAKE" | "PIZZA" | "OTHER";
  images: string[];
  isAvailable: boolean;
  isFeatured: boolean;
  leadTimeHours: number;
  supportsSameDayDelivery: boolean;
  canBeDeliveredPanIndia: boolean;
  isHealthyTreat: boolean;
  categories: { id: string; slug: string; name: string }[];
  tags: ProductTag[];
  flavors: { id: string; slug: string; name: string }[];
}

export interface ProductTag {
  id: string;
  slug: string;
  name: string;
  colorHex: string | null;
}

export function productInCategoryIds(product: { categories: { id: string }[] }, ids: Set<string>) {
  return product.categories.some((c) => ids.has(c.id));
}

export function categoryNames(product: { categories: { name: string }[] }, fallback = "") {
  if (product.categories.length === 0) return fallback;
  return product.categories.map((c) => c.name).join(" · ");
}

export interface PaginatedProductsResponse {
  items: ProductCard[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function useProductsByCategory(
  slug: string | undefined,
  page = 1,
  pageSize = 12,
  filters: CatalogFilterState = EMPTY_CATALOG_FILTERS,
) {
  const filterQs = catalogFiltersToQuerySuffix(filters);
  return useQuery<PaginatedProductsResponse>({
    queryKey: ["products", "category", slug, page, pageSize, filters],
    queryFn: () =>
      api.get<PaginatedProductsResponse>(
        `/products?category=${encodeURIComponent(slug!)}&page=${page}&pageSize=${pageSize}${filterQs}`,
      ),
    enabled: !!slug,
    staleTime: 60_000,
  });
}

export function useProductsByDepartment(
  slug: string | undefined,
  page = 1,
  pageSize = 12,
  filters: CatalogFilterState = EMPTY_CATALOG_FILTERS,
) {
  const filterQs = catalogFiltersToQuerySuffix(filters);
  return useQuery<PaginatedProductsResponse>({
    queryKey: ["products", "department", slug, page, pageSize, filters],
    queryFn: () =>
      api.get<PaginatedProductsResponse>(
        `/products?department=${encodeURIComponent(slug!)}&page=${page}&pageSize=${pageSize}${filterQs}`,
      ),
    enabled: !!slug,
    staleTime: 60_000,
  });
}

export function useSameDayProducts() {
  return useQuery<ProductCard[]>({
    queryKey: ["products", "same-day"],
    queryFn: () => api.get<ProductCard[]>("/products/same-day"),
    staleTime: 30_000,
  });
}

export function usePanIndiaProducts() {
  return useQuery<ProductCard[]>({
    queryKey: ["products", "pan-india"],
    queryFn: () => api.get<ProductCard[]>("/products/pan-india"),
    staleTime: 30_000,
  });
}

export function useHealthyTreatProducts() {
  return useQuery<ProductCard[]>({
    queryKey: ["products", "healthy"],
    queryFn: () => api.get<ProductCard[]>("/products/healthy"),
    staleTime: 30_000,
  });
}

export interface TagShowcaseSection {
  tag: { slug: string; name: string; colorHex: string | null };
  products: ProductCard[];
}

// One row per tag the admin flagged "show on homepage". Empty tags are already
// filtered out server-side, so anything returned here is safe to render.
// Three per tag: one feature tile plus the two stacked beside it.
export function useTagShowcase(limitPerTag = 3) {
  return useQuery<TagShowcaseSection[]>({
    queryKey: ["products", "showcase", limitPerTag],
    queryFn: () => api.get<TagShowcaseSection[]>(`/products/showcase?limit=${limitPerTag}`),
    staleTime: 30_000,
  });
}

export interface TagProductsPage {
  tag: { slug: string; name: string; colorHex: string | null };
  items: ProductCard[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function useProductsByTag(
  slug: string | undefined,
  page = 1,
  pageSize = 12,
  filters: CatalogFilterState = EMPTY_CATALOG_FILTERS,
) {
  const filterQs = catalogFiltersToQuerySuffix(filters);
  return useQuery<TagProductsPage>({
    queryKey: ["products", "tag", slug, page, pageSize, filters],
    queryFn: () =>
      api.get<TagProductsPage>(
        `/products/tag/${slug}?page=${page}&pageSize=${pageSize}${filterQs}`,
      ),
    enabled: !!slug,
    staleTime: 30_000,
  });
}

export interface ProductSearchPage {
  query: string;
  items: ProductCard[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Free-text catalogue search. Queries shorter than 2 chars are not fetched. */
export function useProductSearch(
  q: string,
  page = 1,
  pageSize = 12,
  filters: CatalogFilterState = EMPTY_CATALOG_FILTERS,
) {
  const trimmed = q.trim();
  const filterQs = catalogFiltersToQuerySuffix(filters);
  return useQuery<ProductSearchPage>({
    queryKey: ["products", "search", trimmed, page, pageSize, filters],
    queryFn: () =>
      api.get<ProductSearchPage>(
        `/products/search?q=${encodeURIComponent(trimmed)}&page=${page}&pageSize=${pageSize}${filterQs}`,
      ),
    enabled: trimmed.length >= 2,
    staleTime: 30_000,
  });
}

export interface ProductFlavour {
  id: string;
  slug: string;
  name: string;
  additionalAmount: string;
  isEggless: boolean;
  isSugarFree: boolean;
  isHealthy: boolean;
}

export interface ProductSize {
  id: string;
  grams: number;
  label: string;
  servesText: string | null;
}

export type ProductTemplate = "CAKE" | "PIZZA" | "OTHER";

export interface ProductOption {
  id: string;
  key: string;
  label: string;
  price: string;
  weightGrams: number | null;
  diameterMm: number | null;
  isDefault: boolean;
}

export interface ProductOptionGroup {
  key: string;
  label: string;
  priceMode: "ABSOLUTE" | "DELTA";
  selectionType: "SINGLE" | "MULTIPLE";
  isRequired: boolean;
  options: ProductOption[];
}

export interface ProductTopping {
  id: string;
  slug: string;
  name: string;
  kind: "TOPPING" | "CONDIMENT";
  priceDelta: string;
  isVeg: boolean;
  imageUrl: string | null;
}

export interface ProductAddon {
  id: string;
  slug: string;
  name: string;
  group: string;
  priceDelta: string;
  imageUrl: string | null;
}

export interface ProductDetail {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  images: string[];
  basePrice: string;
  productType: "FIXED_VARIANTS" | "CONFIGURABLE";
  template: ProductTemplate;
  isCustomizable: boolean;
  isEggless: boolean;
  sellByPound: boolean;
  minGrams: number | null;
  maxGrams: number | null;
  allowCustomSize: boolean;
  supportsMessageOnCake: boolean;
  messageMaxLength: number;
  supportsSameDayDelivery: boolean;
  leadTimeHours: number;
  canBeDeliveredPanIndia: boolean;
  isHealthyTreat: boolean;
  gstRate: string;
  priceIsGstInclusive: boolean;
  allergens: string[];
  isActive: boolean;
  isAvailable: boolean;
  categories: {
    id: string;
    slug: string;
    name: string;
    parent: { id: string; slug: string; name: string } | null;
  }[];
  flavors: ProductFlavour[];
  toppings: ProductTopping[];
  addons: ProductAddon[];
  optionGroups: ProductOptionGroup[];
  tags: { id: string; slug: string; name: string; colorHex: string | null }[];
  sizes: ProductSize[];
}

export function useProduct(slug: string | undefined) {
  return useQuery<ProductDetail>({
    queryKey: ["product", slug],
    queryFn: () => api.get<ProductDetail>(`/products/${encodeURIComponent(slug!)}`),
    enabled: !!slug,
    staleTime: 60_000,
  });
}
