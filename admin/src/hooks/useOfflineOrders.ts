import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { OrderLinkKind } from "./useAdminOrderLinks";

export interface OfflineOrderAddress {
  line1: string;
  line2?: string | null;
  landmark?: string | null;
  mapSearchQuery: string;
  pincode: string;
  city?: string | null;
  area?: string | null;
  state?: string | null;
  stateCode?: string | null;
}

export interface OfflineOrderItemPayload {
  kind: OrderLinkKind;
  productId?: string | null;
  productName: string;
  sizeLabel?: string | null;
  sizeGrams?: number | null;
  flavourId?: string | null;
  flavourName?: string | null;
  referenceImageUrl?: string | null;
  messageOnCake?: string | null;
  instructions?: string | null;
  unitPrice: number;
  qty: number;
}

export interface PlaceOfflineOrderPayload {
  items: OfflineOrderItemPayload[];

  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;

  fulfillment: "DELIVERY" | "PICKUP";
  deliveryAddress?: OfflineOrderAddress | null;
  deliveryDate: string;
  deliverySlotKey: string;
  deliverySlotLabel: string;

  customerNotes?: string | null;
  adminNotes?: string | null;

  // How much is being collected right now, and proof of the transfer.
  paymentMode: "FULL" | "ADVANCE";
  advanceAmount?: number;
  paymentScreenshotUrl?: string | null;
}

export interface OfflineOrderResponse {
  id: string;
  orderNumber: string;
  total: string;
}

export function useCreateOfflineOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PlaceOfflineOrderPayload) =>
      api.post<OfflineOrderResponse>("/admin/offline-orders/place", input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "orders"] });
    },
  });
}
