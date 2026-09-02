import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "IN_KITCHEN"
  | "READY"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED";

export type PaymentStatus =
  | "PENDING"
  | "PARTIAL"
  | "PAID"
  | "FAILED"
  | "REFUNDED";
export type OrderFulfillment = "DELIVERY" | "PICKUP";
export type OrderSource = "STOREFRONT" | "OFFLINE_LINK" | "OFFLINE_DIRECT";
export type PaymentMode = "FULL" | "ADVANCE";

export interface AdminOrderListItem {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  fulfillment: OrderFulfillment;
  subtotal: string;
  deliveryFee: string;
  total: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  paymentMode: PaymentMode;
  advanceAmount: string;
  paymentScreenshotUrl: string | null;
  source: OrderSource;
  createdAt: string;
  itemCount: number;
  earliestDelivery: string | null;
  earliestSlotLabel: string | null;
  items: {
    id: string;
    productName: string;
    sizeLabel: string | null;
    flavourName: string | null;
    qty: number;
    messageOnCake: string | null;
    deliveryDate: string | null;
    deliverySlotKey: string | null;
    deliverySlotLabel: string | null;
  }[];
}

export interface AdminOrderItem {
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

export interface AdminOrder extends AdminOrderListItem {
  discount: string;
  couponCode: string | null;
  taxableAmount: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  deliveryAddress: {
    line1: string;
    line2?: string | null;
    landmark?: string | null;
    mapSearchQuery?: string | null;
    pincode: string;
    city?: string | null;
    area?: string | null;
    state?: string | null;
    stateCode?: string | null;
  } | null;
  customerNotes: string | null;
  adminNotes: string | null;
  updatedAt: string;
  items: AdminOrderItem[];
}

export interface AdminOrdersFilter {
  status?: OrderStatus | null;
  deliveryFrom?: string | null; // YYYY-MM-DD (inclusive)
  deliveryTo?: string | null; // YYYY-MM-DD (inclusive)
  page?: number;
  pageSize?: number;
}

export interface AdminOrdersPage {
  items: AdminOrderListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function useAdminOrders(filter?: AdminOrdersFilter) {
  const status = filter?.status ?? null;
  const deliveryFrom = filter?.deliveryFrom ?? null;
  const deliveryTo = filter?.deliveryTo ?? null;
  const page = filter?.page ?? 1;
  const pageSize = filter?.pageSize ?? 20;
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (deliveryFrom) params.set("deliveryFrom", deliveryFrom);
  if (deliveryTo) params.set("deliveryTo", deliveryTo);
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  const qs = params.toString();
  return useQuery<AdminOrdersPage>({
    queryKey: [
      "admin",
      "orders",
      status ?? "ALL",
      deliveryFrom ?? "*",
      deliveryTo ?? "*",
      page,
      pageSize,
    ],
    queryFn: () => api.get<AdminOrdersPage>(`/admin/orders?${qs}`),
    staleTime: 15_000,
  });
}

export function useAdminOrderCounts() {
  return useQuery<Record<OrderStatus | "ALL", number>>({
    queryKey: ["admin", "orders", "counts"],
    queryFn: () =>
      api.get<Record<OrderStatus | "ALL", number>>("/admin/orders/counts"),
    staleTime: 15_000,
  });
}

export function useAdminOrder(idOrNumber: string | undefined) {
  return useQuery<AdminOrder>({
    queryKey: ["admin", "order", idOrNumber],
    queryFn: () => api.get<AdminOrder>(`/admin/orders/${idOrNumber}`),
    enabled: !!idOrNumber,
    staleTime: 15_000,
  });
}

export interface UpdateOrderPayload {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  paymentMode?: PaymentMode;
  advanceAmount?: number;
  paymentScreenshotUrl?: string | null;
  adminNotes?: string | null;
}

export function useUpdateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & UpdateOrderPayload) =>
      api.patch<AdminOrder>(`/admin/orders/${id}`, body),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      void qc.invalidateQueries({ queryKey: ["admin", "order", data.id] });
      void qc.invalidateQueries({
        queryKey: ["admin", "order", data.orderNumber],
      });
    },
  });
}
