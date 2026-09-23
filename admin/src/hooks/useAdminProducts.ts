import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type ProductTemplate = "CAKE" | "PIZZA" | "OTHER";

export interface ProductOptionInput {
  id?: string; // present on read (server-generated), omitted on create/update
  key: string;
  label: string;
  price: number;
  weightGrams?: number | null;
  diameterMm?: number | null;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface AdminOptionGroup {
  id: string;
  key: string;
  label: string;
  priceMode: "ABSOLUTE" | "DELTA";
  selectionType: "SINGLE" | "MULTIPLE";
  isRequired: boolean;
  sortOrder: number;
  options: ProductOptionInput[];
}

export interface AdminProductVariant {
  id: string;
  sku: string;
  label: string;
  price: number;
  attributes: Record<string, unknown> | null;
  isActive: boolean;
  isAvailable: boolean;
  sortOrder: number;
}

export interface AdminProduct {
  id: string;
  slug: string;
  name: string;
  basePrice: string;
  // Resolved from the size option group when the product is variant-priced
  // (e.g. pizzas with basePrice = 0). Equal to basePrice otherwise.
  priceMin: number;
  priceMax: number;
  productType: "FIXED_VARIANTS" | "CONFIGURABLE";
  template: ProductTemplate;
  isActive: boolean;
  isAvailable: boolean;
  isFeatured: boolean;
  archivedAt: string | null;
  images: string[];
  createdAt: string;
  categories: { id: string; name: string; slug: string }[];
}

export type AdminProductListScope = "catalog" | "archived" | "all";

export interface AdminProductsPage {
  items: AdminProduct[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  scope: AdminProductListScope;
}

export function useAdminProducts(
  page = 1,
  pageSize = 20,
  search = "",
  scope: AdminProductListScope = "catalog",
) {
  const q = search.trim();
  return useQuery<AdminProductsPage>({
    queryKey: ["admin", "products", page, pageSize, q, scope],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        scope,
      });
      if (q) params.set("search", q);
      return api.get<AdminProductsPage>(`/admin/products?${params}`);
    },
    staleTime: 30_000,
  });
}

export interface CreateProductPayload {
  name: string;
  slug: string;
  shortDescription?: string | null;
  description?: string | null;
  categoryIds: string[];
  images: string[];
  basePrice: number;
  productType: "FIXED_VARIANTS" | "CONFIGURABLE";
  template: ProductTemplate;
  isCustomizable: boolean;
  isEggless: boolean;
  sellByPound: boolean;
  minGrams?: number | null;
  maxGrams?: number | null;
  allowCustomSize: boolean;
  supportsMessageOnCake: boolean;
  messageMaxLength: number;
  supportsSameDayDelivery: boolean;
  leadTimeHours: number;
  canBeDeliveredPanIndia: boolean;
  isHealthyTreat: boolean;
  gstRate: number;
  hsnCode: string;
  priceIsGstInclusive: boolean;
  allergens: string[];
  metaTitle?: string | null;
  metaDescription?: string | null;
  adminNotes?: string | null;
  kitchenNotes?: string | null;
  isActive: boolean;
  isAvailable: boolean;
  isFeatured: boolean;
  sortOrder: number;
  flavorIds: string[];
  tagIds: string[];
  toppingIds?: string[];
  addonIds?: string[];
  /** Attached add-ons plus category defaults (including parent categories). */
  offeredAddonIds?: string[];
  sizeOptions?: ProductOptionInput[];
  crustOptions?: ProductOptionInput[];
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProductPayload) => api.post<AdminProduct>("/admin/products", input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "products"] });
    },
  });
}

// Detail includes everything the form needs to prefill. `flavorIds`/`tagIds`
// are flattened from the relation for direct use.
export interface AdminProductDetail extends CreateProductPayload {
  id: string;
  updatedAt: string;
  archivedAt: string | null;
  categories: { id: string; name: string; slug: string }[];
  /** From OptionGroup rows (size, crust, tier, …). */
  optionGroups: AdminOptionGroup[];
  /** From ProductVariant table — only for FIXED_VARIANTS SKUs. */
  fixedVariants: AdminProductVariant[];
}

export function useAdminProduct(id: string | undefined) {
  return useQuery<AdminProductDetail>({
    queryKey: ["admin", "product", id],
    queryFn: () => api.get<AdminProductDetail>(`/admin/products/${id}`),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Partial<CreateProductPayload>) =>
      api.patch<AdminProduct>(`/admin/products/${id}`, input),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["admin", "products"] });
      void qc.invalidateQueries({ queryKey: ["admin", "product", vars.id] });
    },
  });
}

export function useDuplicateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<AdminProduct>(`/admin/products/${id}/duplicate`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "products"] });
    },
  });
}

export function useArchiveProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<{ id: string; archivedAt: string | null }>(`/admin/products/${id}/archive`),
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: ["admin", "products"] });
      void qc.invalidateQueries({ queryKey: ["admin", "product", id] });
    },
  });
}

export function useUnarchiveProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<{ id: string; archivedAt: string | null }>(`/admin/products/${id}/unarchive`),
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: ["admin", "products"] });
      void qc.invalidateQueries({ queryKey: ["admin", "product", id] });
    },
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ id: string; name: string }>(`/admin/products/${id}`),
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: ["admin", "products"] });
      void qc.removeQueries({ queryKey: ["admin", "product", id] });
    },
  });
}
