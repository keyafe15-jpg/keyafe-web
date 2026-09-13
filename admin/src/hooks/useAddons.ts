import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface Addon {
  id: string;
  slug: string;
  name: string;
  group: string;
  priceDelta: string;
  imageUrl: string | null;
  sortOrder: number;
}

export interface AdminAddon extends Addon {
  isActive: boolean;
  categoryIds: string[];
}

export function useAddons() {
  return useQuery<Addon[]>({
    queryKey: ["addons"],
    queryFn: () => api.get<Addon[]>("/addons"),
    staleTime: 5 * 60_000,
  });
}

export function useAdminAddons() {
  return useQuery<AdminAddon[]>({
    queryKey: ["admin", "addons"],
    queryFn: () => api.get<AdminAddon[]>("/admin/addons"),
    staleTime: 30_000,
  });
}

export interface CreateAddonPayload {
  name: string;
  slug: string;
  group: string;
  priceDelta: number;
  imageUrl?: string | null;
  categoryIds?: string[];
  sortOrder?: number;
}

export function useCreateAddon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAddonPayload) =>
      api.post<AdminAddon>("/admin/addons", input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "addons"] });
      void qc.invalidateQueries({ queryKey: ["addons"] });
    },
  });
}

export interface UpdateAddonPayload {
  name?: string;
  group?: string;
  priceDelta?: number;
  imageUrl?: string | null;
  categoryIds?: string[];
  sortOrder?: number;
  isActive?: boolean;
}

export function useUpdateAddon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & UpdateAddonPayload) =>
      api.patch<AdminAddon>(`/admin/addons/${id}`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "addons"] });
      void qc.invalidateQueries({ queryKey: ["addons"] });
    },
  });
}
