import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface PublicHeroSlide {
  id: string;
  mediaType: "IMAGE" | "VIDEO";
  desktopUrl: string;
  mobileUrl: string | null;
  posterUrl: string | null;
  title: string | null;
  subtitle: string | null;
  linkUrl: string | null;
}

export function useHeroSlides() {
  return useQuery<PublicHeroSlide[]>({
    queryKey: ["hero-slides"],
    queryFn: () => api.get<PublicHeroSlide[]>("/hero-slides"),
    staleTime: 60_000,
  });
}
