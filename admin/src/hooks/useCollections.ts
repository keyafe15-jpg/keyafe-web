import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { OrderStatus, PaymentStatus } from "@/hooks/useAdminOrders";

export interface CollectionsSummary {
  range: {
    sales: number;
    received: number;
    pending: number;
    orders: number;
    pendingOrders: number;
    /** Stall counter sales, already included in `sales` and `received`. */
    stall: { sales: number; cash: number; upi: number };
  };
  outstandingAllTime: { pending: number; customers: number };
}

export interface PendingOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  /** Earliest delivery day (YYYY-MM-DD), or the placed day for pan-India orders. */
  deliveryDate: string;
  total: number;
  received: number;
  pending: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
}

export interface PendingCustomer {
  customerName: string;
  phone: string;
  pending: number;
  orders: PendingOrder[];
}

export interface PendingCollections {
  pending: number;
  customers: PendingCustomer[];
}

export type CollectionsScope = { from: string; to: string } | "all";

// Keyed under ["admin","orders"] so every order mutation (payment, cancel,
// item edits) refreshes these numbers too.
export function useCollectionsSummary(from: string, to: string, enabled = true) {
  return useQuery<CollectionsSummary>({
    queryKey: ["admin", "orders", "collections", from, to],
    queryFn: () =>
      api.get<CollectionsSummary>(
        `/admin/orders/collections?${new URLSearchParams({ from, to }).toString()}`,
      ),
    staleTime: 30_000,
    enabled: enabled && !!from && !!to,
  });
}

export function usePendingCollections(scope: CollectionsScope, enabled: boolean) {
  const params = new URLSearchParams(scope === "all" ? { scope: "all" } : scope);
  return useQuery<PendingCollections>({
    queryKey: ["admin", "orders", "collections", "pending", params.toString()],
    queryFn: () =>
      api.get<PendingCollections>(`/admin/orders/collections/pending?${params.toString()}`),
    staleTime: 30_000,
    enabled,
  });
}
