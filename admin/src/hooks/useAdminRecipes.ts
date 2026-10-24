import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { RecipeUnit } from "@/pages/recipes/recipe-ui";

export interface RecipeCategory {
  id: string;
  slug: string;
  name: string;
  parentId?: string | null;
  count?: number;
}

export interface RecipeIngredient {
  id?: string;
  name: string;
  qty: number;
  unit: RecipeUnit;
  note: string | null;
  sortOrder?: number;
  buyItemId?: string | null;
  buyItem?: { id: string; name: string } | null;
  componentRecipeId?: string | null;
  componentRecipe?: { id: string; name: string } | null;
}

export interface RecipeUsage {
  id?: string;
  axis1: string;
  axis2: string | null;
  qty: number;
  unit: RecipeUnit;
  sortOrder?: number;
}

export interface RecipeStep {
  id?: string;
  sortOrder?: number;
  text: string;
}

export interface RecipeVersion {
  id: string;
  recipeId: string;
  label: string;
  yieldQty: number | null;
  yieldUnit: RecipeUnit | null;
  yieldNote: string | null;
  printedAt: string | null;
  createdAt: string;
  updatedAt: string;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  usage: RecipeUsage[];
}

export interface AdminRecipe {
  id: string;
  name: string;
  categoryId: string;
  category: RecipeCategory;
  currentVersionId: string | null;
  currentVersion: RecipeVersion | null;
  printed: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  versions: RecipeVersion[];
}

export interface AdminRecipeListRow {
  id: string;
  name: string;
  categoryId: string;
  category: RecipeCategory;
  currentVersionId: string | null;
  versionLabel: string;
  yieldQty: number | null;
  yieldUnit: RecipeUnit | null;
  printed: boolean;
  printedAt: string | null;
  ingredientCount: number;
  updatedAt: string;
}

export interface RecipeWritePayload {
  name: string;
  categoryId: string;
  version: {
    yieldQty?: number | null;
    yieldUnit?: RecipeUnit | null;
    yieldNote?: string | null;
    ingredients: {
      name?: string;
      qty: number;
      unit: RecipeUnit;
      note?: string | null;
      buyItemId?: string | null;
      componentRecipeId?: string | null;
    }[];
    steps: string[];
    usage: { axis1: string; axis2?: string | null; qty: number; unit: RecipeUnit }[];
  };
}

export interface RecipeDraft {
  name: string;
  categoryId: string | null;
  categorySlug: string | null;
  yieldQty: number | null;
  yieldUnit: RecipeUnit | null;
  yieldNote: string | null;
  ingredients: RecipeIngredient[];
  usage: RecipeUsage[];
  steps: string[];
  uncertain: boolean;
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ["admin", "recipes"] });
}

export function useAdminRecipes(filter: {
  search?: string | null;
  category?: string | null;
  printed?: "yes" | "no" | null;
  page?: number;
  pageSize?: number;
}) {
  const page = filter.page ?? 1;
  const pageSize = filter.pageSize ?? 20;
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (filter.search?.trim()) params.set("q", filter.search.trim());
  if (filter.category) params.set("category", filter.category);
  if (filter.printed) params.set("printed", filter.printed);
  return useQuery<{
    items: AdminRecipeListRow[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    categories: RecipeCategory[];
  }>({
    queryKey: ["admin", "recipes", filter],
    queryFn: () => api.get(`/admin/recipes?${params}`),
    staleTime: 15_000,
  });
}

export function useAdminRecipe(id: string | undefined) {
  return useQuery<AdminRecipe>({
    queryKey: ["admin", "recipes", id],
    queryFn: () => api.get(`/admin/recipes/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RecipeWritePayload) => api.post<AdminRecipe>("/admin/recipes", body),
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<RecipeWritePayload>) =>
      api.patch<AdminRecipe>(`/admin/recipes/${id}`, body),
    onSuccess: (data) => {
      invalidate(qc);
      void qc.invalidateQueries({ queryKey: ["admin", "recipes", data.id] });
    },
  });
}

export function useCloneRecipeVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, label }: { id: string; label?: string }) =>
      api.post<AdminRecipe>(`/admin/recipes/${id}/versions`, { label }),
    onSuccess: (data) => {
      invalidate(qc);
      void qc.invalidateQueries({ queryKey: ["admin", "recipes", data.id] });
    },
  });
}

export function useSetCurrentRecipeVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, versionId }: { id: string; versionId: string }) =>
      api.post<AdminRecipe>(`/admin/recipes/${id}/current`, { versionId }),
    onSuccess: (data) => {
      invalidate(qc);
      void qc.invalidateQueries({ queryKey: ["admin", "recipes", data.id] });
    },
  });
}

export function useParseRecipe() {
  return useMutation({
    mutationFn: async (input: { image: File; context?: string }) => {
      const { compressSuggestImage } = await import("@/ai/compressSuggestImage");
      const image = await compressSuggestImage(input.image);
      const form = new FormData();
      form.append("image", image);
      if (input.context?.trim()) form.append("context", input.context.trim().slice(0, 400));
      return api.postForm<RecipeDraft>("/admin/recipes/parse", form);
    },
  });
}

export function useImportRecipes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return api.postForm<{
        created: number;
        skipped: number;
        errors: { name: string; message: string }[];
      }>("/admin/recipes/import", form);
    },
    onSuccess: () => invalidate(qc),
  });
}

export function usePrintRecipes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { recipeIds?: string[]; versionIds?: string[] }) => {
      const { blob, filename } = await api.postBlob("/admin/recipes/print", body);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename ?? "keyafe-recipes.pdf";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 2_000);
    },
    onSuccess: () => invalidate(qc),
  });
}

export function useArchiveRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<{ ok: boolean }>(`/admin/recipes/${id}/archive`, {}),
    onSuccess: () => invalidate(qc),
  });
}
