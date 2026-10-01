import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface StallMenuItem {
  id: string;
  name: string;
  price: number;
  isActive: boolean;
  sortOrder: number;
}

export type StallKind = "OFFICE" | "EXHIBITION";
export type StallChargeBasis = "TOTAL" | "PER_DAY";
/** Offices are always live; exhibitions by their dates (IST). */
export type StallStatus = "live" | "upcoming" | "ended";

export interface StallFields {
  name: string;
  kind: StallKind;
  location: string | null;
  /** YYYY-MM-DD; exhibitions only. */
  startDate: string | null;
  endDate: string | null;
  chargeAmount: number;
  chargeBasis: StallChargeBasis;
  isActive: boolean;
  /** Company billed monthly for office breakfast. */
  billToName?: string | null;
  billToPhone?: string | null;
  billToEmail?: string | null;
  billToGstin?: string | null;
  billToAddress?: BillToAddress | null;
}

export interface BillToAddress {
  line1: string;
  line2?: string | null;
  city?: string | null;
  pincode?: string | null;
}

export interface StallInfo extends StallFields {
  id: string;
  sortOrder: number;
  status: StallStatus;
  /** Days an exhibition runs, inclusive; null for offices. */
  days: number | null;
  /** chargeAmount, or chargeAmount × days when charged per day. */
  effectiveCharge: number;
}

export interface Stall extends StallInfo {
  /** Days the counter may enter sales for (last week, within an exhibition's dates). */
  counterWindow: { from: string; to: string } | null;
  /** Days with any record; a stall with history can't be deleted. */
  dayCount: number;
  menu: StallMenuItem[];
}

export interface StallSummary {
  stall: StallInfo;
  totals: StallTotals & { daysWithSales: number };
  charge: number;
  net: number;
}

export type StallSaleKind = "ITEMIZED" | "CONSOLIDATED";
export type StallDayStatus = "OPEN" | "CLOSED";

export interface StallSale {
  id: string;
  kind: StallSaleKind;
  cashAmount: number;
  upiAmount: number;
  /** Still owed; 0 once collected. */
  dueAmount: number;
  dueFrom: string | null;
  /** Set when a due was collected (its amount is then in cash/UPI). */
  duePaidAt: string | null;
  duePaidByName: string | null;
  note: string | null;
  createdByName: string | null;
  createdAt: string;
  items: { id: string; menuItemId: string | null; name: string; price: number; qty: number }[];
}

export interface StallMoney {
  cash: number;
  upi: number;
  due: number;
  /** cash + upi */
  received: number;
  /** cash + upi + due */
  total: number;
}

export interface StallTotals extends StallMoney {
  count: number;
}

export interface StallDue {
  id: string;
  kind: StallSaleKind;
  amount: number;
  dueFrom: string | null;
  note: string | null;
  createdByName: string | null;
  createdAt: string;
  items: { name: string; qty: number }[];
  date: string;
  stall: { id: string; name: string };
}

export type StallPaymentMethod = "CASH" | "UPI" | "DUE";

export interface StallDayView {
  /** Null until the first entry of the day is saved. */
  id: string | null;
  date: string;
  status: StallDayStatus;
  closedAt: string | null;
  closedByName: string | null;
  stall: { id: string; name: string };
  sales: StallSale[];
  /** Once a day has a lump sum, only lump entries count toward these. */
  totals: StallTotals;
  lumpOverride: boolean;
  tappedTotals: StallMoney;
  itemsSold: { name: string; qty: number; amount: number }[];
}

export interface StallBreakfastEntry {
  id: string;
  date: string;
  plates: number;
  platePrice: number;
  items: string;
  note: string | null;
  /** The month-end bill this went on; billed entries are locked. */
  orderId: string | null;
  createdByName: string | null;
  createdAt: string;
  amount: number;
}

export interface StallBreakfastBill {
  id: string;
  orderNumber: string;
  invoiceNumber: string | null;
  paymentStatus: "PENDING" | "PARTIAL" | "PAID" | "FAILED" | "REFUNDED";
  total: number;
  createdAt: string;
}

export interface StallBreakfastMonth {
  stall: {
    id: string;
    name: string;
    billToName: string | null;
    billToPhone: string | null;
    billToEmail: string | null;
    billToGstin: string | null;
    billToAddress: BillToAddress | null;
  };
  month: string;
  monthLabel: string;
  entries: StallBreakfastEntry[];
  totals: {
    plates: number;
    amount: number;
    days: number;
    unbilledCount: number;
    unbilledAmount: number;
  };
  bills: StallBreakfastBill[];
  /** The stall's latest plate, any month, to prefill the add form. */
  last: { plates: number; platePrice: number; items: string } | null;
  /** Item names typed into recent breakfasts. */
  itemNames: string[];
}

export interface StallBreakfastInput {
  date?: string;
  plates: number;
  platePrice: number;
  items: string;
  note?: string | null;
}

export interface StallDaySummary extends StallTotals {
  id: string;
  date: string;
  status: StallDayStatus;
  stall: { id: string; name: string };
  lumpOverride: boolean;
}

export interface StallDaysList {
  days: StallDaySummary[];
  totals: StallTotals;
}

export type StallSaleInput =
  | {
      kind: "ITEMIZED";
      paymentMethod: StallPaymentMethod;
      items: { menuItemId: string; qty: number }[];
      /** Required when paymentMethod is DUE. */
      dueFrom?: string;
      note?: string;
    }
  | {
      kind: "CONSOLIDATED";
      cashAmount: number;
      upiAmount: number;
      dueAmount?: number;
      /** Required when dueAmount > 0. */
      dueFrom?: string;
      note?: string;
    };

const STALLS = ["admin", "stalls"] as const;

// Stall money feeds the dashboard's sales/received cards.
function refreshSales(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: [...STALLS, "days"] });
  void qc.invalidateQueries({ queryKey: [...STALLS, "day"] });
  void qc.invalidateQueries({ queryKey: [...STALLS, "today"] });
  void qc.invalidateQueries({ queryKey: [...STALLS, "summary"] });
  void qc.invalidateQueries({ queryKey: [...STALLS, "dues"] });
  void qc.invalidateQueries({ queryKey: ["admin", "orders", "collections"] });
}

function refreshStalls(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: [...STALLS, "list"] });
  void qc.invalidateQueries({ queryKey: [...STALLS, "manage"] });
  void qc.invalidateQueries({ queryKey: [...STALLS, "summary"] });
}

/** Active stalls with their active menu — what the counter shows. */
export function useStalls(enabled = true) {
  return useQuery<Stall[]>({
    queryKey: [...STALLS, "list"],
    queryFn: () => api.get<Stall[]>("/admin/stalls"),
    staleTime: 60_000,
    enabled,
  });
}

/** Every stall and menu item, including switched-off ones. */
export function useManageStalls(enabled = true) {
  return useQuery<Stall[]>({
    queryKey: [...STALLS, "manage"],
    queryFn: () => api.get<Stall[]>("/admin/stalls/manage"),
    staleTime: 30_000,
    enabled,
  });
}

/** The counter's day — today, or a missed day picked on the counter. */
export function useStallCounterDay(stallId: string | null, date: string) {
  return useQuery<StallDayView>({
    queryKey: [...STALLS, "today", stallId, date],
    queryFn: () => api.get<StallDayView>(`/admin/stalls/${stallId}/today?date=${date}`),
    enabled: !!stallId && !!date,
    staleTime: 15_000,
  });
}

export function useStallDays(from: string, to: string, stallId: string | null, enabled = true) {
  const params = new URLSearchParams({ from, to, ...(stallId ? { stallId } : {}) });
  return useQuery<StallDaysList>({
    queryKey: [...STALLS, "days", params.toString()],
    queryFn: () => api.get<StallDaysList>(`/admin/stalls/days?${params.toString()}`),
    enabled: enabled && !!from && !!to,
    staleTime: 30_000,
  });
}

/** All-time sales for one stall against its stall charge. */
export function useStallSummary(stallId: string | null) {
  return useQuery<StallSummary>({
    queryKey: [...STALLS, "summary", stallId],
    queryFn: () => api.get<StallSummary>(`/admin/stalls/${stallId}/summary`),
    enabled: !!stallId,
    staleTime: 30_000,
  });
}

/** Any past day's sheet; an empty open day when nothing was recorded. */
export function useStallDay(stallId: string | null, date: string | null) {
  return useQuery<StallDayView>({
    queryKey: [...STALLS, "day", stallId, date],
    queryFn: () => api.get<StallDayView>(`/admin/stalls/${stallId}/days/${date}`),
    enabled: !!stallId && !!date,
  });
}

// ---------- Counter mutations ----------

export function useRecordStallSale(stallId: string | null, date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: StallSaleInput) =>
      api.post<StallDayView>(`/admin/stalls/${stallId}/sales`, { ...input, date }),
    onSuccess: (day) => {
      qc.setQueryData([...STALLS, "today", stallId, date], day);
      refreshSales(qc);
    },
  });
}

export function useCloseStallDay(stallId: string | null, date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<StallDayView>(`/admin/stalls/${stallId}/today/close`, { date }),
    onSuccess: (day) => {
      qc.setQueryData([...STALLS, "today", stallId, date], day);
      refreshSales(qc);
    },
  });
}

export function useDeleteStallSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (saleId: string) => api.delete<StallDayView>(`/admin/stalls/sales/${saleId}`),
    onSuccess: () => refreshSales(qc),
  });
}

// ---------- Dues ----------

/** Unpaid due entries, oldest first; every stall unless one is given. */
export function useStallDues(stallId?: string | null) {
  return useQuery<{ total: number; dues: StallDue[] }>({
    queryKey: [...STALLS, "dues", stallId ?? "all"],
    queryFn: () =>
      api.get<{ total: number; dues: StallDue[] }>(
        `/admin/stalls/dues${stallId ? `?stallId=${stallId}` : ""}`,
      ),
    staleTime: 15_000,
  });
}

export function useSettleStallDue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ saleId, paidVia }: { saleId: string; paidVia: "CASH" | "UPI" }) =>
      api.post<StallDayView>(`/admin/stalls/sales/${saleId}/settle`, { paidVia }),
    onSuccess: () => refreshSales(qc),
  });
}

// ---------- Office breakfast ----------

function refreshBreakfast(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: [...STALLS, "breakfast"] });
  void qc.invalidateQueries({ queryKey: ["admin", "orders", "collections"] });
}

export function useStallBreakfastMonth(stallId: string | null, month: string) {
  return useQuery<StallBreakfastMonth>({
    queryKey: [...STALLS, "breakfast", stallId, month],
    queryFn: () =>
      api.get<StallBreakfastMonth>(`/admin/stalls/${stallId}/breakfast?month=${month}`),
    enabled: !!stallId && !!month,
    staleTime: 15_000,
  });
}

export function useAddStallBreakfast(stallId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: StallBreakfastInput) =>
      api.post<StallBreakfastEntry>(`/admin/stalls/${stallId}/breakfast`, input),
    onSuccess: () => refreshBreakfast(qc),
  });
}

export function useUpdateStallBreakfast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<StallBreakfastInput>) =>
      api.patch<{ ok: boolean }>(`/admin/stalls/breakfast/${id}`, body),
    onSuccess: () => refreshBreakfast(qc),
  });
}

export function useDeleteStallBreakfast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ ok: boolean }>(`/admin/stalls/breakfast/${id}`),
    onSuccess: () => refreshBreakfast(qc),
  });
}

/** Raises the month's bill as an order; it then shows in Pending until paid. */
export function useCreateStallBreakfastBill(stallId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (month: string) =>
      api.post<{ id: string; orderNumber: string }>(`/admin/stalls/${stallId}/breakfast/bill`, {
        month,
      }),
    onSuccess: () => {
      refreshBreakfast(qc);
      void qc.invalidateQueries({ queryKey: ["admin", "orders"] });
    },
  });
}

export function useDownloadBreakfastStatement() {
  return useMutation({
    mutationFn: async ({ stallId, month }: { stallId: string; month: string }) => {
      const { blob, filename } = await api.getBlob(
        `/admin/stalls/${stallId}/breakfast/statement?month=${month}`,
      );
      const name = filename ?? `breakfast-${month}.pdf`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Revoking immediately can cancel the download in some browsers.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      return { filename: name };
    },
  });
}

// ---------- Admin: days ----------

export function useAddStallDaySale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      stallId,
      date,
      input,
    }: {
      stallId: string;
      date: string;
      input: StallSaleInput;
    }) => api.post<StallDayView>(`/admin/stalls/${stallId}/days/${date}/sales`, input),
    onSuccess: () => refreshSales(qc),
  });
}

export function useSetStallDayStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ dayId, action }: { dayId: string; action: "close" | "reopen" }) =>
      api.post<StallDayView>(`/admin/stalls/days/${dayId}/${action}`, {}),
    onSuccess: () => refreshSales(qc),
  });
}

// ---------- Admin: stalls & menu ----------

export function useCreateStall() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<StallFields> & { name: string; copyMenuFrom?: string }) =>
      api.post<{ id: string }>("/admin/stalls", input),
    onSuccess: () => refreshStalls(qc),
  });
}

export function useUpdateStall() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<StallFields>) =>
      api.patch<{ ok: boolean }>(`/admin/stalls/${id}`, body),
    onSuccess: () => {
      refreshStalls(qc);
      refreshSales(qc);
      void qc.invalidateQueries({ queryKey: [...STALLS, "breakfast"] });
    },
  });
}

export function useCopyStallMenu() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ stallId, fromStallId }: { stallId: string; fromStallId: string }) =>
      api.post<{ copied: number }>(`/admin/stalls/${stallId}/menu/copy`, { fromStallId }),
    onSuccess: () => refreshStalls(qc),
  });
}

export function useDeleteStall() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ id: string; name: string }>(`/admin/stalls/${id}`),
    onSuccess: () => refreshStalls(qc),
  });
}

export function useCreateStallMenuItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ stallId, ...body }: { stallId: string; name: string; price: number }) =>
      api.post<StallMenuItem>(`/admin/stalls/${stallId}/menu`, body),
    onSuccess: () => refreshStalls(qc),
  });
}

export function useUpdateStallMenuItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      name?: string;
      price?: number;
      isActive?: boolean;
    }) => api.patch<StallMenuItem>(`/admin/stalls/menu/${id}`, body),
    onSuccess: () => refreshStalls(qc),
  });
}

export function useDeleteStallMenuItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ id: string; name: string }>(`/admin/stalls/menu/${id}`),
    onSuccess: () => refreshStalls(qc),
  });
}

export function useReorderStallMenu(stallId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: string[]) =>
      api.post<{ ok: boolean }>(`/admin/stalls/${stallId}/menu/reorder`, { orderedIds }),
    onSuccess: () => refreshStalls(qc),
  });
}
