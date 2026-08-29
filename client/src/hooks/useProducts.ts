import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

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
  category: { id: string; slug: string; name: string };
}

export function useProductsByCategory(slug: string | undefined) {
  return useQuery<ProductCard[]>({
    queryKey: ["products", "category", slug],
    queryFn: () =>
      api.get<ProductCard[]>(`/products?category=${encodeURIComponent(slug!)}`),
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
  gstRate: string;
  priceIsGstInclusive: boolean;
  allergens: string[];
  isActive: boolean;
  isAvailable: boolean;
  category: {
    id: string;
    slug: string;
    name: string;
    parent: { id: string; slug: string; name: string } | null;
  };
  flavors: ProductFlavour[];
  toppings: ProductTopping[];
  optionGroups: ProductOptionGroup[];
  tags: { id: string; slug: string; name: string; colorHex: string | null }[];
  sizes: ProductSize[];
}

export function useProduct(slug: string | undefined) {
  return useQuery<ProductDetail>({
    queryKey: ["product", slug],
    queryFn: () =>
      api.get<ProductDetail>(`/products/${encodeURIComponent(slug!)}`),
    enabled: !!slug,
    staleTime: 60_000,
  });
}
