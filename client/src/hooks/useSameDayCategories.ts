import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface SameDayCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
}

export function useSameDayCategories() {
  return useQuery<SameDayCategory[]>({
    queryKey: ["store", "same-day-categories"],
    queryFn: () => api.get<SameDayCategory[]>("/store/same-day-categories"),
    staleTime: 5 * 60_000,
  });
}
