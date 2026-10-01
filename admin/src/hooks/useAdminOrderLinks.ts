import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ProductTemplate } from "@/hooks/useAdminProducts";

export type OrderLinkKind = "CUSTOM" | "CATALOG";
export type OrderLinkStatus = "OPEN" | "ORDERED" | "EXPIRED" | "CANCELLED";

export interface OrderLinkItem {
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
  description: string | null;
  customTemplate: ProductTemplate | null;
  unitPrice: string;
  qty: number;
}

export interface OrderLink {
  id: string;
  token: string;
  items: OrderLinkItem[];
  customerName: string | null;
  customerPhone: string | null;
  suggestedDate: string | null;
  suggestedSlotKey: string | null;
  suggestedSlotLabel: string | null;
  adminNotes: string | null;
  status: OrderLinkStatus;
  expiresAt: string | null;
  discountType: "FLAT" | "PERCENT" | null;
  discountValue: string | null;
  /** Locked delivery fee when set; otherwise customer pays pincode table rate. */
  deliveryFee: string | null;
  /** Customer may pay online via Cashfree; otherwise pay on delivery / pickup only. */
  allowOnlinePayment: boolean;
  linkedOrder: {
    id: string;
    orderNumber: string;
    total: string;
    customerName: string;
    status: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderLinkItemPayload {
  kind: OrderLinkKind;
  productId?: string | null;
  productName: string;
  sizeLabel?: string | null;
  sizeGrams?: number | null;
  flavourId?: string | null;
  flavourName?: string | null;
  referenceImageUrl?: string | null;
  messageHint?: string | null;
  description?: string | null;
  customTemplate?: ProductTemplate | null;
  unitPrice: number;
  qty: number;
}

export interface CreateOrderLinkPayload {
  items: OrderLinkItemPayload[];
  customerName?: string | null;
  customerPhone?: string | null;
  suggested?: {
    date?: string | null;
    key?: string | null;
    label?: string | null;
  } | null;
  adminNotes?: string | null;
  expiresInDays?: number | null;
  discountType?: "FLAT" | "PERCENT" | null;
  discountValue?: number | null;
  /** Lock delivery fee for this link; null = use pincode table when customer orders. */
  deliveryFee?: number | null;
  allowOnlinePayment?: boolean;
}

export function useAdminOrderLinks(status?: OrderLinkStatus | "ALL") {
  const qs = status && status !== "ALL" ? `?status=${status}` : "";
  return useQuery<OrderLink[]>({
    queryKey: ["admin", "order-links", status ?? "ALL"],
    queryFn: () => api.get<OrderLink[]>(`/admin/order-links${qs}`),
    staleTime: 15_000,
  });
}

export function useCreateOrderLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOrderLinkPayload) => api.post<OrderLink>("/admin/order-links", input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "order-links"] });
    },
  });
}

export interface UpdateOrderLinkPayload {
  status?: "CANCELLED";
  expiresInDays?: number | null;
  adminNotes?: string | null;

  // Spec edits — server rejects if the link isn't OPEN.
  items?: OrderLinkItemPayload[];
  customerName?: string | null;
  customerPhone?: string | null;
  discountType?: "FLAT" | "PERCENT" | null;
  discountValue?: number | null;
  deliveryFee?: number | null;
  allowOnlinePayment?: boolean;
}

/** Whether Cashfree keys are configured on the server at all. */
export function useOnlinePaymentAvailable() {
  return useQuery({
    queryKey: ["admin", "payments", "config"],
    queryFn: () => api.get<{ cashfreeEnabled: boolean; mode: string }>("/payments/config"),
    staleTime: 5 * 60_000,
    select: (d) => d.cashfreeEnabled,
  });
}

export function useAdminOrderLink(id: string | undefined) {
  return useQuery<OrderLink>({
    queryKey: ["admin", "order-link", id],
    queryFn: () => api.get<OrderLink>(`/admin/order-links/${id}`),
    enabled: !!id,
    staleTime: 15_000,
  });
}

/** Only links that never became an order can be deleted. */
export function useDeleteOrderLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ id: string }>(`/admin/order-links/${id}`),
    onSuccess: ({ id }) => {
      void qc.invalidateQueries({ queryKey: ["admin", "order-links"] });
      qc.removeQueries({ queryKey: ["admin", "order-link", id] });
    },
  });
}

export function useUpdateOrderLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & UpdateOrderLinkPayload) =>
      api.patch<OrderLink>(`/admin/order-links/${id}`, body),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ["admin", "order-links"] });
      void qc.invalidateQueries({ queryKey: ["admin", "order-link", data.id] });
    },
  });
}
