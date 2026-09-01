import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Order } from "./useOrders";

export type OrderLinkKind = "CUSTOM" | "CATALOG";
export type OrderLinkStatus = "OPEN" | "ORDERED" | "EXPIRED" | "CANCELLED";

export interface PublicOrderLinkItem {
  id: string;
  kind: OrderLinkKind;
  productId: string | null;
  productName: string;
  sizeLabel: string | null;
  sizeGrams: number | null;
  flavourId: string | null;
  flavourName: string | null;
  referenceImageUrl: string | null;
  messageHint: string | null;
  unitPrice: string;
  qty: number;
}

export interface PublicOrderLink {
  id: string;
  token: string;
  items: PublicOrderLinkItem[];
  customerName: string | null;
  customerPhone: string | null;
  suggestedDate: string | null;
  suggestedSlotKey: string | null;
  suggestedSlotLabel: string | null;
  status: OrderLinkStatus;
  expiresAt: string | null;
  linkedOrder: { orderNumber: string } | null;
}

export function useOrderLink(token: string | undefined) {
  return useQuery<PublicOrderLink>({
    queryKey: ["order-link", token],
    queryFn: () => api.get<PublicOrderLink>(`/order-links/${token}`),
    enabled: !!token,
    staleTime: 5_000,
  });
}

export interface PlaceOrderLinkPayload {
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  fulfillment: "DELIVERY" | "PICKUP";
  deliveryAddress?: {
    line1: string;
    line2?: string | null;
    landmark?: string | null;
    mapSearchQuery: string;
    pincode: string;
    city?: string | null;
    area?: string | null;
    state?: string | null;
    stateCode?: string | null;
  } | null;
  deliveryDate: string;
  deliverySlotKey: string;
  deliverySlotLabel: string;
  customerNotes?: string | null;

  // How much is being paid now, and proof of the transfer. Both are absent
  // for COD (advanceAmount: 0, paymentScreenshotUrl: null).
  paymentMode: "FULL" | "ADVANCE";
  advanceAmount?: number;
  paymentScreenshotUrl: string | null;
}

export interface UsePlaceOrderLinkArgs {
  token: string;
}

export function usePlaceOrderLink({ token }: UsePlaceOrderLinkArgs) {
  return useMutation({
    mutationFn: (input: PlaceOrderLinkPayload) =>
      api.post<Order>(`/order-links/${token}/place`, input),
  });
}
