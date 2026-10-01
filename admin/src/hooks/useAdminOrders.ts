import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type OrderStatus =
  "PENDING" | "CONFIRMED" | "IN_KITCHEN" | "READY" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED";

export type PaymentStatus = "PENDING" | "PARTIAL" | "PAID" | "FAILED" | "REFUNDED";
export type OrderFulfillment = "DELIVERY" | "PICKUP";
export type OrderSource = "STOREFRONT" | "OFFLINE_LINK" | "OFFLINE_DIRECT" | "STALL_BILL";
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
  paymentScreenshotUrls: string[];
  /** Set once an online (Cashfree) payment is confirmed. */
  paidAt: string | null;
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
    description: string | null;
    referenceImageUrl: string | null;
    deliveryDate: string | null;
    deliverySlotKey: string | null;
    deliverySlotLabel: string | null;
  }[];
}

export interface AdminOrderItem {
  id: string;
  productId: string | null;
  productName: string;
  productSlug: string | null;
  productImage: string | null;
  sizeGrams: number | null;
  sizeLabel: string | null;
  flavourId: string | null;
  flavourName: string | null;
  messageOnCake: string | null;
  instructions: string | null;
  description: string | null;
  referenceImageUrl: string | null;
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

export type PaymentAttemptStatus = "CREATED" | "SUCCESS" | "FAILED" | "USER_DROPPED" | "EXPIRED";

export interface AdminPaymentAttempt {
  id: string;
  gatewayOrderId: string;
  amount: string;
  status: PaymentAttemptStatus;
  gatewayPaymentId: string | null;
  paymentGroup: string | null;
  createdAt: string;
  updatedAt: string;
}

// `items` is omitted because the detail endpoint returns the full
// AdminOrderItem shape, not the trimmed one the list endpoint sends.
export interface AdminOrder extends Omit<AdminOrderListItem, "items"> {
  paymentAttempts?: AdminPaymentAttempt[];
  /** deliveryFee was paid to the rider, so it is not in total. */
  deliveryPaidToRider: boolean;
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
  creditNotes: AdminCreditNote[];
  /** Money sent back to the customer's online payment. */
  gatewayRefunds?: AdminGatewayRefund[];
  /** Net of active credit notes; limits are what a new credit note may be. */
  money: {
    discounts: number;
    refunds: number;
    netTotal: number;
    received: number;
    pending: number;
    maxDiscount: number;
    maxRefund: number;
    /** Most that can go back to the customer's online payment in one refund. */
    onlineRefundable: number;
  };
}

export type GatewayRefundStatus = "PENDING" | "SUCCESS" | "CANCELLED" | "ONHOLD";

export interface AdminGatewayRefund {
  id: string;
  amount: string;
  status: GatewayRefundStatus;
  refundId: string;
  creditNoteId: string | null;
  note: string | null;
  createdByName: string | null;
  createdAt: string;
}

export type CreditNoteKind = "DISCOUNT" | "REFUND";
export type CreditNoteReason =
  | "QUALITY"
  | "DAMAGED"
  | "LATE_DELIVERY"
  | "WRONG_ITEM"
  | "GOODWILL"
  | "OTHER";

export interface AdminCreditNote {
  id: string;
  creditNoteNumber: string;
  creditNoteDate: string;
  kind: CreditNoteKind;
  reason: CreditNoteReason;
  note: string | null;
  amount: string;
  taxableAmount: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  refundMethod: string | null;
  proofUrl: string | null;
  createdByName: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  createdAt: string;
  gatewayRefund?: { status: GatewayRefundStatus; amount: string; refundId: string } | null;
}

export interface IssueCreditNotePayload {
  kind: CreditNoteKind;
  amount: number;
  reason: CreditNoteReason;
  note?: string | null;
  refundMethod?: string | null;
  proofUrl?: string | null;
}

type OrderRef = { id: string; orderNumber: string };

function invalidateOrder(qc: ReturnType<typeof useQueryClient>, order: OrderRef) {
  void qc.invalidateQueries({ queryKey: ["admin", "orders"] });
  void qc.invalidateQueries({ queryKey: ["admin", "order", order.id] });
  void qc.invalidateQueries({ queryKey: ["admin", "order", order.orderNumber] });
}

export function useIssueCreditNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ order, payload }: { order: OrderRef; payload: IssueCreditNotePayload }) =>
      api.post<AdminCreditNote>(`/admin/orders/${order.id}/credit-notes`, payload),
    onSuccess: (_data, { order }) => invalidateOrder(qc, order),
  });
}

export function useVoidCreditNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ order, id, reason }: { order: OrderRef; id: string; reason: string }) =>
      api.post<AdminCreditNote>(`/admin/orders/${order.id}/credit-notes/${id}/void`, { reason }),
    onSuccess: (_data, { order }) => invalidateOrder(qc, order),
  });
}

export function useDownloadCreditNote() {
  return useMutation({
    mutationFn: async ({ orderId, note }: { orderId: string; note: AdminCreditNote }) => {
      const { blob, filename } = await api.getBlob(
        `/admin/orders/${orderId}/credit-notes/${note.id}/pdf`,
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename ?? `${note.creditNoteNumber.replace(/[^A-Za-z0-9-]+/g, "-")}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    },
  });
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

export function useRefreshPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (order: { id: string; orderNumber: string }) =>
      api.post<{ state: "PAID" | "PENDING" | "FAILED" | "NOT_ONLINE" }>(
        `/admin/payments/orders/${order.id}/refresh`,
      ),
    onSuccess: (_data, order) => {
      void qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      void qc.invalidateQueries({ queryKey: ["admin", "order", order.id] });
      void qc.invalidateQueries({ queryKey: ["admin", "order", order.orderNumber] });
    },
  });
}

/** Matches the server cap: advance, balance, and one spare. */
export const MAX_PAYMENT_SCREENSHOTS = 3;

export interface UpdateOrderPayload {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  paymentMode?: PaymentMode;
  advanceAmount?: number;
  paymentMethod?: "cash" | "upi" | "netbanking";
  paymentScreenshotUrls?: string[];
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

export interface EditOrderItemPayload {
  id?: string;
  productId?: string | null;
  productName: string;
  sizeGrams?: number | null;
  sizeLabel?: string | null;
  flavourId?: string | null;
  flavourName?: string | null;
  messageOnCake?: string | null;
  instructions?: string | null;
  description?: string | null;
  referenceImageUrl?: string | null;
  unitPrice: number;
  qty: number;
}

export interface EditOrderItemsPayload {
  items: EditOrderItemPayload[];
  collectedNow?: number;
  deliveryPaidToRider?: boolean;
}

export interface EditOrderItemsResult {
  order: AdminOrder;
  previousTotal: number;
  newTotal: number;
  /** Still to be paid back by hand. */
  refundDue: number;
  /** Sent back to the customer's online payment while saving. */
  refundedOnline: number;
  collectedNow: number;
}

export function useEditOrderItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & EditOrderItemsPayload) =>
      api.patch<EditOrderItemsResult>(`/admin/orders/${id}/items`, body),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      void qc.invalidateQueries({ queryKey: ["admin", "order", data.order.id] });
      void qc.invalidateQueries({
        queryKey: ["admin", "order", data.order.orderNumber],
      });
    },
  });
}

/** Permanently deletes an order; the server checks the retyped order number. */
export function useDeleteOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, confirmOrderNumber }: { id: string; confirmOrderNumber: string }) =>
      api.delete<{ orderNumber: string }>(`/admin/orders/${id}`, { confirmOrderNumber }),
    onSuccess: (data, { id }) => {
      qc.removeQueries({ queryKey: ["admin", "order", id] });
      qc.removeQueries({ queryKey: ["admin", "order", data.orderNumber] });
      for (const key of ["orders", "order-counts", "order-links", "customers", "customer"]) {
        void qc.invalidateQueries({ queryKey: ["admin", key] });
      }
    },
  });
}

export interface UpdateBuyerGstResult {
  order: AdminOrder;
  placeOfSupplyChanged: boolean;
}

/**
 * Adds, changes or removes the buyer's GSTIN on an order. The server re-splits
 * the GST already charged between CGST+SGST and IGST to match the new place of
 * supply; the order total never changes.
 */
export function useUpdateBuyerGst() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      customerGstin: string | null;
      customerCompanyName: string | null;
    }) => api.patch<UpdateBuyerGstResult>(`/admin/orders/${id}/buyer-gst`, body),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      void qc.invalidateQueries({ queryKey: ["admin", "order", data.order.id] });
      void qc.invalidateQueries({
        queryKey: ["admin", "order", data.order.orderNumber],
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

export type GstExportInput =
  | { mode: "range"; from: string; to: string; format: "xlsx" | "pdf" }
  | { mode: "fy"; fy: string; format: "xlsx" | "pdf" };

/** GST invoice register for the accountant — Excel workbook or summary PDF. */
export function useDownloadGstExport() {
  return useMutation({
    mutationFn: async (input: GstExportInput) => {
      const params = new URLSearchParams({ format: input.format });
      if (input.mode === "fy") {
        params.set("fy", input.fy);
      } else {
        params.set("from", input.from);
        params.set("to", input.to);
      }
      const { blob, filename, headers } = await api.getBlob(
        `/admin/orders/gst-export?${params.toString()}`,
      );
      const name =
        filename ??
        `gst-register.${input.format === "pdf" ? "pdf" : "xlsx"}`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);

      return {
        filename: name,
        count: headers.get("X-Gst-Export-Count"),
        period: headers.get("X-Gst-Export-Period"),
      };
    },
  });
}

function triggerBrowserDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Full orders backup for disaster recovery — XLSX (2 sheets) or denormalized CSV. */
export function useDownloadOrdersBackup() {
  return useMutation({
    mutationFn: async (input: {
      format: "xlsx" | "csv";
      from?: string;
      to?: string;
    }) => {
      const params = new URLSearchParams({ format: input.format });
      if (input.from) params.set("from", input.from);
      if (input.to) params.set("to", input.to);
      const { blob, filename, headers } = await api.getBlob(
        `/admin/orders/backup?${params.toString()}`,
      );
      const name = filename ?? `orders-backup.${input.format}`;
      triggerBrowserDownload(blob, name);
      return {
        filename: name,
        orderCount: headers.get("X-Backup-Order-Count"),
        itemCount: headers.get("X-Backup-Item-Count"),
        period: headers.get("X-Backup-Period"),
      };
    },
  });
}

export interface OrdersBackupImportResult {
  created: number;
  updated: number;
  itemCount: number;
  skipped: number;
  errors: string[];
}

/** Reimport an orders backup XLSX/CSV (upsert by order number). */
export function useImportOrdersBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return api.postForm<OrdersBackupImportResult>("/admin/orders/backup/import", form);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      void qc.invalidateQueries({ queryKey: ["admin", "order-counts"] });
      void qc.invalidateQueries({ queryKey: ["admin", "orders", "analytics"] });
    },
  });
}
