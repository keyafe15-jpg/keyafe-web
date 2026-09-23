import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type OrderStatus =
  "PENDING" | "CONFIRMED" | "IN_KITCHEN" | "READY" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED";

export type PaymentStatus = "PENDING" | "PARTIAL" | "PAID" | "FAILED" | "REFUNDED";
export type OrderFulfillment = "DELIVERY" | "PICKUP";
export type OrderSource = "STOREFRONT" | "OFFLINE_LINK" | "OFFLINE_DIRECT";
export type PaymentMode = "FULL" | "ADVANCE";

export interface AdminOrderListItem {
  id: string;
  orderNumber: string;
  customerName: string;
  /** Set on corporate orders; the contact person stays in customerName. */
  customerCompanyName: string | null;
  customerPhone: string;
  customerEmail: string | null;
  recipientName?: string | null;
  deliveryPhone?: string | null;
  isSurpriseGift?: boolean;
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
  isPanIndia?: boolean;
  pincode?: string | null;
  city?: string | null;
  items: {
    id: string;
    productName: string;
    productImage: string | null;
    sizeLabel: string | null;
    flavourName: string | null;
    qty: number;
    messageOnCake: string | null;
    instructions: string | null;
    referenceImageUrl: string | null;
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
  // Per-line GST snapshot. Null on orders placed before invoicing existed.
  hsnCode: string | null;
  gstRate: string | null;
  taxableValue: string | null;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
}

// `items` is omitted because the detail endpoint returns the full
// AdminOrderItem shape, not the trimmed one the list endpoint sends.
export interface AdminOrder extends Omit<AdminOrderListItem, "items"> {
  discount: string;
  couponCode: string | null;
  taxableAmount: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  // GST / invoicing (customerCompanyName is inherited from the list item)
  customerGstin: string | null;
  /** Two-digit state code the CGST+SGST vs IGST split was decided against. */
  placeOfSupply: string | null;
  /** Null until an invoice is first downloaded or emailed. */
  invoiceNumber: string | null;
  invoiceDate: string | null;
  /** Null until a delivery challan is first downloaded. Its own series. */
  challanNumber: string | null;
  challanDate: string | null;
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
  billingAddress: {
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
  search?: string | null;
  excludeStatuses?: OrderStatus[];
  panIndia?: boolean;
  page?: number;
  pageSize?: number;
  /** When false, the query is idle (e.g. kitchen board while searching). Default true. */
  enabled?: boolean;
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
  const search = filter?.search?.trim() ?? "";
  const excludeStatuses = filter?.excludeStatuses ?? [];
  const panIndia = Boolean(filter?.panIndia);
  const page = filter?.page ?? 1;
  const pageSize = filter?.pageSize ?? 20;
  const enabled = filter?.enabled !== false;
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (deliveryFrom) params.set("deliveryFrom", deliveryFrom);
  if (deliveryTo) params.set("deliveryTo", deliveryTo);
  if (search) params.set("search", search);
  if (excludeStatuses.length > 0) {
    params.set("excludeStatus", excludeStatuses.join(","));
  }
  if (panIndia) params.set("panIndia", "1");
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
      search || "*",
      excludeStatuses.join(",") || "*",
      panIndia ? "pan" : "any",
      page,
      pageSize,
    ],
    queryFn: () => api.get<AdminOrdersPage>(`/admin/orders?${qs}`),
    staleTime: 15_000,
    enabled,
  });
}

export function useAdminOrderCounts() {
  return useQuery<Record<OrderStatus | "ALL", number>>({
    queryKey: ["admin", "orders", "counts"],
    queryFn: () => api.get<Record<OrderStatus | "ALL", number>>("/admin/orders/counts"),
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
  items?: {
    id: string;
    deliveryDate: string | null;
    deliverySlotKey: string | null;
    deliverySlotLabel: string | null;
  }[];
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

/**
 * Downloads the invoice PDF. The first download assigns the order its
 * permanent invoice number, so the order is refetched afterwards to pick it up.
 */
export function useDownloadInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (order: { id: string; orderNumber: string }) => {
      const { blob, filename, headers } = await api.getBlob(`/admin/orders/${order.id}/invoice`);
      const name = filename ?? `invoice-${order.orderNumber}.pdf`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Revoking immediately can cancel the download in some browsers.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);

      return { invoiceNumber: headers.get("X-Invoice-Number"), filename: name };
    },
    onSuccess: (_data, order) => {
      void qc.invalidateQueries({ queryKey: ["admin", "order", order.id] });
      void qc.invalidateQueries({
        queryKey: ["admin", "order", order.orderNumber],
      });
    },
  });
}

export interface InvoiceEmailResult {
  sent: boolean;
  to: string | null;
  invoiceNumber: string;
}

export function useEmailInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (order: { id: string }) =>
      api.post<InvoiceEmailResult>(`/admin/orders/${order.id}/invoice/email`),
    onSuccess: (_data, order) => {
      void qc.invalidateQueries({ queryKey: ["admin", "order", order.id] });
    },
  });
}

/**
 * Downloads the delivery challan. Mirrors useDownloadInvoice, including
 * reading the issued number off the response header — the number is minted
 * server-side on this very request, so it isn't on the cached order yet.
 */
export function useDownloadChallan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (order: { id: string; orderNumber: string }) => {
      const { blob, filename, headers } = await api.getBlob(`/admin/orders/${order.id}/challan`);
      const name = filename ?? `challan-${order.orderNumber}.pdf`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Revoking immediately can cancel the download in some browsers.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);

      return { challanNumber: headers.get("X-Challan-Number"), filename: name };
    },
    onSuccess: (_data, order) => {
      void qc.invalidateQueries({ queryKey: ["admin", "order", order.id] });
      void qc.invalidateQueries({
        queryKey: ["admin", "order", order.orderNumber],
      });
    },
  });
}
