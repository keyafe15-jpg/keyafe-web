import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface CouponPreview {
  code: string;
  discount: number;
  waivesDelivery: boolean;
  label: string;
  freeDelivery: {
    active: boolean;
    label: string | null;
  };
}

export interface FreeDeliveryState {
  active: boolean;
  from: string | null;
  until: string | null;
  minCart: number | null;
  label: string | null;
}

export function useFreeDelivery(subtotal: number) {
  return useQuery<FreeDeliveryState>({
    queryKey: ["free-delivery", Math.round(subtotal)],
    queryFn: () =>
      api.get<FreeDeliveryState>(
        `/coupons/free-delivery?subtotal=${encodeURIComponent(String(subtotal))}`,
      ),
    staleTime: 30_000,
  });
}

export function usePublicCoupons() {
  return useQuery<PublicCoupon[]>({
    queryKey: ["public-coupons"],
    queryFn: () => api.get<PublicCoupon[]>("/coupons/public"),
    staleTime: 30_000,
  });
}

export interface PublicCoupon {
  code: string;
  type: "PERCENT" | "FLAT";
  value: number;
  headline: string;
  copy: string | null;
  waivesDelivery: boolean;
  remaining: number | null;
  limited: boolean;
  validUntil: string;
}

export function usePreviewCoupon() {
  return useMutation({
    mutationFn: (body: {
      code: string;
      customerPhone: string;
      items: { productId: string; unitPrice: number; qty: number }[];
      subtotal: number;
    }) => api.post<CouponPreview>("/coupons/preview", body),
  });
}
