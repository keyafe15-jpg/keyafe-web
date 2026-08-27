import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface AdminCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  parentId: string | null;
  parentName: string | null;
  parentSlug: string | null;
  productCount: number;
  childCount: number;
}

export function useAdminCategories() {
  return useQuery<AdminCategory[]>({
    queryKey: ["admin", "categories"],
    queryFn: () => api.get<AdminCategory[]>("/admin/categories"),
    staleTime: 30_000,
  });
}

export interface CategoryPayload {
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  parentId?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

const invalidate = (qc: ReturnType<typeof useQueryClient>) => {
  void qc.invalidateQueries({ queryKey: ["admin", "categories"] });
  // Public category tree drives the storefront + product form dropdowns.
  void qc.invalidateQueries({ queryKey: ["categories"] });
};

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CategoryPayload) =>
      api.post<AdminCategory>("/admin/categories", input),
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<CategoryPayload>) =>
      api.patch<AdminCategory>(`/admin/categories/${id}`, body),
    onSuccess: () => invalidate(qc),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/admin/categories/${id}`),
    onSuccess: () => invalidate(qc),
  });
}
