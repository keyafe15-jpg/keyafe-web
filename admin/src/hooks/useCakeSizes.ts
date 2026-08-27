import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface CakeSize {
  id: string;
  grams: number;
  label: string;
  servesText: string | null;
  sortOrder: number;
  isActive: boolean;
}

export function useAdminCakeSizes() {
  return useQuery<CakeSize[]>({
    queryKey: ["admin", "cake-sizes"],
    queryFn: () => api.get<CakeSize[]>("/admin/cake-sizes"),
    staleTime: 60_000,
  });
}

export interface CakeSizePayload {
  grams: number;
  label: string;
  servesText?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export function useCreateCakeSize() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CakeSizePayload) =>
      api.post<CakeSize>("/admin/cake-sizes", input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "cake-sizes"] });
    },
  });
}

export function useUpdateCakeSize() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<CakeSizePayload>) =>
      api.patch<CakeSize>(`/admin/cake-sizes/${id}`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "cake-sizes"] });
    },
  });
}

export function useDeleteCakeSize() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/admin/cake-sizes/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "cake-sizes"] });
    },
  });
}
