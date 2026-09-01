import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface WeeklyHours {
  dayOfWeek: number;
  isClosed: boolean;
  openTime: string;
  closeTime: string;
}

export interface ShopClosure {
  id: string;
  startsOn: string;
  endsOn: string;
  reason: string | null;
}

export interface StoreHours {
  timezone: string;
  isSameDayStoreClosed: boolean;
  sameDayClosedMessage: string;
  weekly: WeeklyHours[];
  closures: ShopClosure[];
  status: {
    isOpen: boolean;
    message: string;
    openTime?: string;
    closeTime?: string;
    timezone: string;
  };
}

export function useStoreHours() {
  return useQuery<StoreHours>({
    queryKey: ["admin", "store", "hours"],
    queryFn: () => api.get<StoreHours>("/admin/store/hours"),
    staleTime: 15_000,
  });
}

export function useUpdateStoreHours() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      input: Pick<
        StoreHours,
        "isSameDayStoreClosed" | "sameDayClosedMessage" | "weekly"
      >,
    ) => api.patch<StoreHours>("/admin/store/hours", input),
    onSuccess: (data) => {
      qc.setQueryData(["admin", "store", "hours"], data);
    },
  });
}

export function useCreateShopClosure() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      startsOn: string;
      endsOn: string;
      reason?: string | null;
    }) => api.post<ShopClosure>("/admin/store/closures", input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "store", "hours"] });
    },
  });
}

export function useDeleteShopClosure() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/admin/store/closures/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "store", "hours"] });
    },
  });
}
