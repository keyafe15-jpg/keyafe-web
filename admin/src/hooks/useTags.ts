import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface Tag {
  id: string;
  slug: string;
  name: string;
  colorHex: string | null;
}

export function useTags() {
  return useQuery<Tag[]>({
    queryKey: ["tags"],
    queryFn: () => api.get<Tag[]>("/tags"),
    staleTime: 5 * 60_000,
  });
}
