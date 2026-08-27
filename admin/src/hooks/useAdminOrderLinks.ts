import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type OrderLinkKind = "CUSTOM" | "CATALOG";
export type OrderLinkStatus = "OPEN" | "ORDERED" | "EXPIRED" | "CANCELLED";

export interface OrderLink {
  id: string;
  token: string;
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
  customerName: string | null;
  customerPhone: string | null;
  suggestedDate: string | null;
  suggestedSlotKey: string | null;
  suggestedSlotLabel: string | null;
  adminNotes: string | null;
  status: OrderLinkStatus;
  expiresAt: string | null;
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

export interface CreateOrderLinkPayload {
  kind: OrderLinkKind;
  productId?: string | null;
  productName: string;
  sizeLabel?: string | null;
  sizeGrams?: number | null;
  flavourId?: string | null;
  flavourName?: string | null;
  referenceImageUrl?: string | null;
  messageHint?: string | null;
  unitPrice: number;
  qty: number;
  customerName?: string | null;
  customerPhone?: string | null;
  suggested?: {
    date?: string | null;
    key?: string | null;
    label?: string | null;
  } | null;
  adminNotes?: string | null;
  expiresInDays?: number | null;
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
    mutationFn: (input: CreateOrderLinkPayload) =>
      api.post<OrderLink>("/admin/order-links", input),
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
  kind?: OrderLinkKind;
  productId?: string | null;
  productName?: string;
  sizeLabel?: string | null;
  sizeGrams?: number | null;
  flavourId?: string | null;
  flavourName?: string | null;
  referenceImageUrl?: string | null;
  messageHint?: string | null;
  unitPrice?: number;
  qty?: number;
  customerName?: string | null;
  customerPhone?: string | null;
}

export function useAdminOrderLink(id: string | undefined) {
  return useQuery<OrderLink>({
    queryKey: ["admin", "order-link", id],
    queryFn: () => api.get<OrderLink>(`/admin/order-links/${id}`),
    enabled: !!id,
    staleTime: 15_000,
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
