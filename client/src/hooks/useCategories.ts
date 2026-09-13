import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface CategoryNode {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
  department: { id: string; slug: string; name: string } | null;
  children: CategoryNode[];
}

export function useCategories() {
  return useQuery<CategoryNode[]>({
    queryKey: ["categories"],
    queryFn: () => api.get<CategoryNode[]>("/categories"),
    staleTime: 5 * 60_000,
  });
}
