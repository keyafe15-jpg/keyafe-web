import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface PublicAnnouncement {
  text: string;
  linkUrl: string | null;
  linkLabel: string | null;
}

export function usePublicAnnouncement() {
  return useQuery<PublicAnnouncement | null>({
    queryKey: ["store", "announcement"],
    queryFn: () => api.get<PublicAnnouncement | null>("/store/announcement"),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });
}
