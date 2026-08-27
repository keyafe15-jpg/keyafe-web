import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface Flavour {
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

export function useFlavours() {
  return useQuery<Flavour[]>({
    queryKey: ["flavours"],
    queryFn: () => api.get<Flavour[]>("/flavours"),
    staleTime: 5 * 60_000,
  });
}

export interface AdminFlavour extends Flavour {
  isActive: boolean;
}

export function useAdminFlavours() {
  return useQuery<AdminFlavour[]>({
    queryKey: ["admin", "flavours"],
    queryFn: () => api.get<AdminFlavour[]>("/admin/flavours"),
    staleTime: 30_000,
  });
}

export interface UpdateFlavourPayload {
  name?: string;
  description?: string | null;
  isEggless?: boolean;
  isSugarFree?: boolean;
  isHealthy?: boolean;
  additionalAmount?: number;
  sortOrder?: number;
  isActive?: boolean;
}

export function useUpdateFlavour() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & UpdateFlavourPayload) =>
      api.patch<AdminFlavour>(`/admin/flavours/${id}`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "flavours"] });
      void qc.invalidateQueries({ queryKey: ["flavours"] });
    },
  });
}
