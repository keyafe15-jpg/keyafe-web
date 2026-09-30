import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface StallMenuItem {
  id: string;
  name: string;
  price: number;
  isActive: boolean;
  sortOrder: number;
}

export interface Stall {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  /** Days with any record; a stall with history can't be deleted. */
  dayCount: number;
  menu: StallMenuItem[];
}

export type StallSaleKind = "ITEMIZED" | "CONSOLIDATED";
export type StallDayStatus = "OPEN" | "CLOSED";

export interface StallSale {
  id: string;
  kind: StallSaleKind;
  cashAmount: number;
  upiAmount: number;
  note: string | null;
  createdByName: string | null;
  createdAt: string;
  items: { id: string; menuItemId: string | null; name: string; price: number; qty: number }[];
}

export interface StallTotals {
  cash: number;
  upi: number;
  total: number;
  count: number;
}

export interface StallDayView {
  /** Null until the first entry of the day is saved. */
  id: string | null;
  date: string;
  status: StallDayStatus;
  closedAt: string | null;
  closedByName: string | null;
  stall: { id: string; name: string };
  sales: StallSale[];
  totals: StallTotals;
  itemsSold: { name: string; qty: number; amount: number }[];
}

export interface StallDaySummary extends StallTotals {
  id: string;
  date: string;
  status: StallDayStatus;
  stall: { id: string; name: string };
}

export interface StallDaysList {
  days: StallDaySummary[];
  totals: StallTotals;
}

export type StallSaleInput =
  | {
      kind: "ITEMIZED";
      paymentMethod: "CASH" | "UPI";
      items: { menuItemId: string; qty: number }[];
      note?: string;
    }
  | { kind: "CONSOLIDATED"; cashAmount: number; upiAmount: number; note?: string };

const STALLS = ["admin", "stalls"] as const;

// Stall money feeds the dashboard's sales/received cards.
function refreshSales(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: [...STALLS, "days"] });
  void qc.invalidateQueries({ queryKey: [...STALLS, "day"] });
  void qc.invalidateQueries({ queryKey: [...STALLS, "today"] });
  void qc.invalidateQueries({ queryKey: ["admin", "orders", "collections"] });
}

function refreshStalls(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: [...STALLS, "list"] });
  void qc.invalidateQueries({ queryKey: [...STALLS, "manage"] });
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
export function useManageStalls() {
  return useQuery<Stall[]>({
    queryKey: [...STALLS, "manage"],
    queryFn: () => api.get<Stall[]>("/admin/stalls/manage"),
    staleTime: 30_000,
  });
}

export function useStallToday(stallId: string | null) {
  return useQuery<StallDayView>({
    queryKey: [...STALLS, "today", stallId],
    queryFn: () => api.get<StallDayView>(`/admin/stalls/${stallId}/today`),
    enabled: !!stallId,
    staleTime: 15_000,
  });
}

export function useStallDays(from: string, to: string, enabled = true) {
  return useQuery<StallDaysList>({
    queryKey: [...STALLS, "days", from, to],
    queryFn: () =>
      api.get<StallDaysList>(`/admin/stalls/days?${new URLSearchParams({ from, to }).toString()}`),
    enabled: enabled && !!from && !!to,
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

export function useRecordStallSale(stallId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: StallSaleInput) =>
      api.post<StallDayView>(`/admin/stalls/${stallId}/sales`, input),
    onSuccess: (day) => {
      qc.setQueryData([...STALLS, "today", stallId], day);
      refreshSales(qc);
    },
  });
}

export function useCloseStallToday(stallId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<StallDayView>(`/admin/stalls/${stallId}/today/close`, {}),
    onSuccess: (day) => {
      qc.setQueryData([...STALLS, "today", stallId], day);
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
    mutationFn: (input: { name: string }) => api.post<{ id: string }>("/admin/stalls", input),
    onSuccess: () => refreshStalls(qc),
  });
}

export function useUpdateStall() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; isActive?: boolean }) =>
      api.patch<{ ok: boolean }>(`/admin/stalls/${id}`, body),
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
