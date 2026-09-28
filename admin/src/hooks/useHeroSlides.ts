import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const MAX_HERO_SLIDES = 6;

export type HeroMediaType = "IMAGE" | "VIDEO";

export interface HeroSlide {
  id: string;
  mediaType: HeroMediaType;
  desktopUrl: string;
  mobileUrl: string | null;
  posterUrl: string | null;
  title: string | null;
  subtitle: string | null;
  linkUrl: string | null;
  sortOrder: number;
  isActive: boolean;
}

export type HeroSlideInput = Omit<HeroSlide, "id" | "sortOrder">;

const KEY = ["admin", "hero-slides"] as const;

export function useAdminHeroSlides() {
  return useQuery<HeroSlide[]>({
    queryKey: KEY,
    queryFn: () => api.get<HeroSlide[]>("/admin/hero-slides"),
    staleTime: 30_000,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: KEY });
}

export function useCreateHeroSlide() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: HeroSlideInput) => api.post<HeroSlide>("/admin/hero-slides", input),
    onSuccess: invalidate,
  });
}

export function useUpdateHeroSlide() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...input }: HeroSlideInput & { id: string }) =>
      api.patch<HeroSlide>(`/admin/hero-slides/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useToggleHeroSlide() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch<HeroSlide>(`/admin/hero-slides/${id}/active`, { isActive }),
    onSuccess: invalidate,
  });
}

export function useReorderHeroSlides() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => api.patch<HeroSlide[]>("/admin/hero-slides/reorder", { ids }),
    onSuccess: (slides) => qc.setQueryData(KEY, slides),
  });
}

export function useDeleteHeroSlide() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ ok: true }>(`/admin/hero-slides/${id}`),
    onSuccess: invalidate,
  });
}
