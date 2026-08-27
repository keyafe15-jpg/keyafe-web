import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface SameDayStatus {
  isOpen: boolean;
  message: string;
  openTime?: string;
  closeTime?: string;
  timezone: string;
}

export function useSameDayStatus() {
  return useQuery<SameDayStatus>({
    queryKey: ["store", "same-day-status"],
    queryFn: () => api.get<SameDayStatus>("/store/same-day-status"),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });
}
