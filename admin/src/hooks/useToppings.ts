import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type ToppingKind = "TOPPING" | "CONDIMENT";

export interface Topping {
  id: string;
  slug: string;
  name: string;
  kind: ToppingKind;
  priceDelta: string;
  isVeg: boolean;
  imageUrl: string | null;
  sortOrder: number;
}

export interface AdminTopping extends Topping {
  isActive: boolean;
}

export function useToppings(kind?: ToppingKind) {
  const qs = kind ? `?kind=${kind}` : "";
  return useQuery<Topping[]>({
    queryKey: ["toppings", kind ?? "all"],
    queryFn: () => api.get<Topping[]>(`/toppings${qs}`),
    staleTime: 5 * 60_000,
  });
}

export function useAdminToppings() {
  return useQuery<AdminTopping[]>({
    queryKey: ["admin", "toppings"],
    queryFn: () => api.get<AdminTopping[]>("/admin/toppings"),
    staleTime: 30_000,
  });
}

export interface CreateToppingPayload {
  name: string;
  slug: string;
  kind: ToppingKind;
  priceDelta: number;
  isVeg: boolean;
  sortOrder?: number;
}

export function useCreateTopping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateToppingPayload) =>
      api.post<AdminTopping>("/admin/toppings", input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "toppings"] });
      void qc.invalidateQueries({ queryKey: ["toppings"] });
    },
  });
}

export interface UpdateToppingPayload {
  name?: string;
  kind?: ToppingKind;
  priceDelta?: number;
  isVeg?: boolean;
  sortOrder?: number;
  isActive?: boolean;
}

export function useUpdateTopping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & UpdateToppingPayload) =>
      api.patch<AdminTopping>(`/admin/toppings/${id}`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "toppings"] });
      void qc.invalidateQueries({ queryKey: ["toppings"] });
    },
  });
}
