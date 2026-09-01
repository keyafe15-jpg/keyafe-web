import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/store/auth";

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  productImage: string | null;
  sizeGrams: number | null;
  sizeLabel: string | null;
  flavourId: string | null;
  flavourName: string | null;
  messageOnCake: string | null;
  instructions: string | null;
  deliveryDate: string | null;
  deliverySlotKey: string | null;
  deliverySlotLabel: string | null;
  unitPrice: string;
  qty: number;
  lineTotal: string;
}

export interface OrderAddress {
  line1: string;
  line2?: string | null;
  landmark?: string | null;
  mapSearchQuery?: string | null;
  pincode: string;
  city?: string | null;
  area?: string | null;
  state?: string | null;
  stateCode?: string | null;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  fulfillment: "DELIVERY" | "PICKUP";
  deliveryAddress: OrderAddress | null;
  subtotal: string;
  deliveryFee: string;
  discount: string;
  total: string;
  taxableAmount: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  paymentMethod: string;
  paymentStatus: "PENDING" | "PARTIAL" | "PAID" | "FAILED" | "REFUNDED";
  paymentMode: "FULL" | "ADVANCE";
  advanceAmount: string;
  paymentScreenshotUrl: string | null;
  status:
    | "PENDING"
    | "CONFIRMED"
    | "IN_KITCHEN"
    | "READY"
    | "OUT_FOR_DELIVERY"
    | "DELIVERED"
    | "CANCELLED";
  customerNotes: string | null;
  createdAt: string;
  items: OrderItem[];
}

export interface CreateOrderItem {
  productId: string;
  sizeGrams?: number | null;
  sizeLabel?: string | null;
  flavourId?: string | null;
  flavourName?: string | null;
  messageOnCake?: string | null;
  instructions?: string | null;
  deliveryDate?: string | null;
  deliverySlotKey?: string | null;
  deliverySlotLabel?: string | null;
  unitPrice: number;
  qty: number;
}

export interface CreateOrderPayload {
  userId?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  fulfillment: "DELIVERY" | "PICKUP";
  deliveryAddress?: OrderAddress | null;
  customerNotes?: string | null;
  paymentMethod: "cod" | "upi" | "razorpay";
  items: CreateOrderItem[];
}

export function useCreateOrder() {
  return useMutation({
    mutationFn: (input: CreateOrderPayload) => {
      const auth = useAuth.getState();
      const token = auth.accessToken;
      const payload = {
        ...input,
        userId: input.userId ?? auth.user?.id,
      };

      return api.post<Order>("/orders", payload, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
    },
  });
}

export function useOrder(idOrNumber: string | undefined) {
  return useQuery<Order>({
    queryKey: ["order", idOrNumber],
    queryFn: () => api.get<Order>(`/orders/${idOrNumber}`),
    enabled: !!idOrNumber,
    staleTime: 30_000,
  });
}

export function useUserOrders() {
  return useQuery<Order[]>({
    queryKey: ["user-orders"],
    queryFn: () => {
      const token = useAuth.getState().accessToken;
      return api.get<Order[]>("/orders/me", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
    },
    enabled: !!useAuth.getState().accessToken,
    staleTime: 30_000,
  });
}
