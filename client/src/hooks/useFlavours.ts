import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface MasterFlavour {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isEggless: boolean;
  isSugarFree: boolean;
  isHealthy: boolean;
  imageUrl: string | null;
  additionalAmount: string;
  sortOrder: number;
}

export function useMasterFlavours() {
  return useQuery<MasterFlavour[]>({
    queryKey: ["flavours"],
    queryFn: () => api.get<MasterFlavour[]>("/flavours"),
    staleTime: 5 * 60_000,
  });
}
