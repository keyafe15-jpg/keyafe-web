import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface Tag {
  id: string;
  slug: string;
  name: string;
  colorHex: string | null;
}

export interface AdminTag extends Tag {
  productCount: number;
}

export function useTags() {
  return useQuery<Tag[]>({
    queryKey: ["tags"],
    queryFn: () => api.get<Tag[]>("/tags"),
    staleTime: 5 * 60_000,
  });
}

export function useAdminTags() {
  return useQuery<AdminTag[]>({
    queryKey: ["admin", "tags"],
    queryFn: () => api.get<AdminTag[]>("/admin/tags"),
    staleTime: 30_000,
  });
}

export interface CreateTagPayload {
  name: string;
  slug: string;
  colorHex?: string | null;
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTagPayload) =>
      api.post<AdminTag>("/admin/tags", input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "tags"] });
      void qc.invalidateQueries({ queryKey: ["tags"] });
    },
  });
}

export interface UpdateTagPayload {
  name?: string;
  slug?: string;
  colorHex?: string | null;
}

export function useUpdateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & UpdateTagPayload) =>
      api.patch<AdminTag>(`/admin/tags/${id}`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "tags"] });
      void qc.invalidateQueries({ queryKey: ["tags"] });
    },
  });
}
