import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  OrderFulfillment,
  OrderSource,
  OrderStatus,
  PaymentStatus,
} from "@/hooks/useAdminOrders";

/** One cake due at a particular delivery event. */
export interface ScheduleItem {
  id: string;
  productName: string;
  productImage: string | null;
  sizeLabel: string | null;
  flavourName: string | null;
  qty: number;
  messageOnCake: string | null;
  instructions: string | null;
  referenceImageUrl: string | null;
}

export interface ScheduleOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerCompanyName: string | null;
  customerPhone: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillment: OrderFulfillment;
  source: OrderSource;
  isSurpriseGift?: boolean;
  /**
   * The whole order's total, not this event's. An order split across two
   * dates appears twice, so never sum this across entries.
   */
  orderTotal: string;
  pincode: string | null;
  city: string | null;
}

/**
 * A single handover: everything from one order going out on one date in one
 * slot. An order with items on two dates yields two of these.
 */
export interface ScheduleEntry {
  key: string;
  deliveryDate: string;
  deliverySlotKey: string | null;
  deliverySlotLabel: string | null;
  itemCount: number;
  totalQty: number;
  order: ScheduleOrder | null;
  items: ScheduleItem[];
}

export interface OrderSchedulePage {
  items: ScheduleEntry[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface OrderScheduleFilter {
  deliveryFrom?: string | null; // YYYY-MM-DD (inclusive)
  deliveryTo?: string | null; // YYYY-MM-DD (inclusive)
  status?: OrderStatus | null;
  excludeStatuses?: OrderStatus[];
  search?: string | null;
  /** Sorts by delivery date. Defaults to soonest first. */
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export function useOrderSchedule(filter?: OrderScheduleFilter) {
  const deliveryFrom = filter?.deliveryFrom ?? null;
  const deliveryTo = filter?.deliveryTo ?? null;
  const status = filter?.status ?? null;
  const excludeStatuses = filter?.excludeStatuses ?? [];
  const search = filter?.search?.trim() ?? "";
  const dir = filter?.dir ?? "asc";
  const page = filter?.page ?? 1;
  const pageSize = filter?.pageSize ?? 25;

  const params = new URLSearchParams();
  if (deliveryFrom) params.set("deliveryFrom", deliveryFrom);
  if (deliveryTo) params.set("deliveryTo", deliveryTo);
  if (status) params.set("status", status);
  if (excludeStatuses.length > 0) {
    params.set("excludeStatus", excludeStatuses.join(","));
  }
  if (search) params.set("search", search);
  params.set("dir", dir);
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  const qs = params.toString();

  return useQuery<OrderSchedulePage>({
    queryKey: [
      "admin",
      "order-schedule",
      deliveryFrom ?? "*",
      deliveryTo ?? "*",
      status ?? "ALL",
      excludeStatuses.join(",") || "*",
      search || "*",
      dir,
      page,
      pageSize,
    ],
    queryFn: () => api.get<OrderSchedulePage>(`/admin/orders/schedule?${qs}`),
    staleTime: 15_000,
  });
}
