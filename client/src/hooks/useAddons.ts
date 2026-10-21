import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface PublicAddon {
  id: string;
  slug: string;
  name: string;
  group: string | null;
  priceDelta: string | number;
  imageUrl: string | null;
}

export function usePublicAddons() {
  return useQuery({
    queryKey: ["addons"],
    queryFn: () => api.get<PublicAddon[]>("/addons"),
    staleTime: 60_000,
  });
}
