import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type CouponType = "PERCENT" | "FLAT";

export interface AdminCoupon {
  code: string;
  type: CouponType;
  value: string;
  minCartAmount: string | null;
  maxDiscount: string | null;
  applicableCategoryIds: string[];
  perCustomerLimit: number | null;
  totalUsageLimit: number | null;
  usageCount: number;
  validFrom: string;
  validUntil: string;
  waivesDelivery: boolean;
  restrictedToPhone: string | null;
  note: string | null;
  showOnStorefront: boolean;
  headline: string | null;
  storefrontCopy: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface CouponPayload {
  code: string;
  type: CouponType;
  value: number;
  minCartAmount: number | null;
  maxDiscount: number | null;
  applicableCategoryIds: string[];
  perCustomerLimit: number | null;
  totalUsageLimit: number | null;
  validFrom: string;
  validUntil: string;
  waivesDelivery: boolean;
  restrictedToPhone: string | null;
  note: string | null;
  showOnStorefront: boolean;
  headline: string | null;
  storefrontCopy: string | null;
  isActive: boolean;
}

export interface FreeDeliverySettings {
  freeDeliveryFrom: string | null;
  freeDeliveryUntil: string | null;
  freeDeliveryMinCart: number | null;
}

export function useAdminCoupons() {
  return useQuery<AdminCoupon[]>({
    queryKey: ["admin", "coupons"],
    queryFn: () => api.get<AdminCoupon[]>("/admin/coupons"),
  });
}

export function useUpsertCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CouponPayload) =>
      api.post<AdminCoupon>("/admin/coupons", body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin", "coupons"] }),
  });
}

export function useSetCouponActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ code, isActive }: { code: string; isActive: boolean }) =>
      api.patch<AdminCoupon>(`/admin/coupons/${code}/active`, { isActive }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin", "coupons"] }),
  });
}

export function useEmailCoupon() {
  return useMutation({
    mutationFn: ({ code, to }: { code: string; to: string }) =>
      api.post<{ ok: boolean }>(`/admin/coupons/${code}/email`, { to }),
  });
}

export function useFreeDeliverySettings() {
  return useQuery<FreeDeliverySettings>({
    queryKey: ["admin", "free-delivery"],
    queryFn: () => api.get<FreeDeliverySettings>("/admin/coupons/free-delivery"),
  });
}

export function useUpdateFreeDelivery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: FreeDeliverySettings) =>
      api.patch<FreeDeliverySettings>("/admin/coupons/free-delivery", body),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ["admin", "free-delivery"] }),
  });
}
