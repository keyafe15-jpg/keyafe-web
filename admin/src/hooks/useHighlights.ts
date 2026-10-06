import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const MAX_HIGHLIGHTS = 6;

export interface Highlight {
  id: string;
  title: string;
  tagline: string | null;
  themeColor: string;
  bannerImage: string | null;
  /** India calendar day, YYYY-MM-DD. Null = no limit. */
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  sortOrder: number;
  category: { id: string; name: string; slug: string } | null;
  tag: { id: string; name: string; slug: string } | null;
  products: { id: string; name: string; image: string | null }[];
}

export interface HighlightInput {
  title: string;
  tagline: string | null;
  themeColor: string;
  bannerImage: string | null;
  startDate: string | null;
  endDate: string | null;
  categoryId: string | null;
  tagId: string | null;
  productIds: string[];
  isActive: boolean;
}

const KEY = ["admin", "highlights"] as const;

export function useAdminHighlights() {
  return useQuery<Highlight[]>({
    queryKey: KEY,
    queryFn: () => api.get<Highlight[]>("/admin/highlights"),
    staleTime: 30_000,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: KEY });
}

export function useCreateHighlight() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: HighlightInput) => api.post<Highlight>("/admin/highlights", input),
    onSuccess: invalidate,
  });
}

export function useUpdateHighlight() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...input }: HighlightInput & { id: string }) =>
      api.patch<Highlight>(`/admin/highlights/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useToggleHighlight() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch<Highlight>(`/admin/highlights/${id}/active`, { isActive }),
    onSuccess: invalidate,
  });
}

export function useReorderHighlights() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => api.patch<Highlight[]>("/admin/highlights/reorder", { ids }),
    onSuccess: (rows) => qc.setQueryData(KEY, rows),
  });
}

export function useDeleteHighlight() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ ok: true }>(`/admin/highlights/${id}`),
    onSuccess: invalidate,
  });
}
