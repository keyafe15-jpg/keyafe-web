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
  images: string[];
  createdAt: string;
  category: { id: string; name: string; slug: string };
}

export function useAdminProducts() {
  return useQuery<AdminProduct[]>({
    queryKey: ["admin", "products"],
    queryFn: () => api.get<AdminProduct[]>("/admin/products"),
    staleTime: 30_000,
  });
}

export interface CreateProductPayload {
  name: string;
  slug: string;
  shortDescription?: string | null;
  description?: string | null;
  categoryId: string;
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
  sizeOptions?: ProductOptionInput[];
  crustOptions?: ProductOptionInput[];
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProductPayload) =>
      api.post<AdminProduct>("/admin/products", input),
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
  category: { id: string; name: string; slug: string };
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
    mutationFn: ({
      id,
      ...input
    }: { id: string } & Partial<CreateProductPayload>) =>
      api.patch<AdminProduct>(`/admin/products/${id}`, input),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["admin", "products"] });
      void qc.invalidateQueries({ queryKey: ["admin", "product", vars.id] });
    },
  });
}
