import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  BooksPaymentMethod,
  BuyItemUnit,
  ExpensePurpose,
  PurchasePurpose,
} from "@/pages/expenses/books-ui";

export interface BooksPage<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AdminBuyItem {
  id: string;
  name: string;
  nameNormalized: string;
  unit: BuyItemUnit;
  packSize: number | null;
  isActive: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  timesBought?: number;
  totalQty?: number;
  totalSpent?: number;
  lastDate?: string | null;
  lastVendor?: string | null;
  lastRate?: number | null;
  vendorCount?: number;
}

export interface BuyItemHistoryRow {
  id: string;
  purchaseId: string;
  date: string;
  vendor: { id: string; name: string };
  qty: number;
  unitPrice: number;
  amount: number;
  purpose: PurchasePurpose;
  vsLast: number | null;
  vsCheapest90: number;
}

export interface AdminBuyItemDetail extends AdminBuyItem {
  history: BooksPage<BuyItemHistoryRow>;
}

export interface PurchaseLine {
  id: string;
  buyItemId: string;
  buyItem: { id: string; name: string; unit: BuyItemUnit; packSize: number | null };
  qty: number;
  unitPrice: number;
  amount: number;
  purpose: PurchasePurpose | null;
}

export interface AdminPurchase {
  id: string;
  date: string;
  vendorId: string;
  vendor: { id: string; name: string; phone: string | null; channel: "OFFLINE" | "ONLINE" };
  purpose: PurchasePurpose;
  paymentMethod: BooksPaymentMethod;
  notes: string | null;
  shipping: number;
  total: number;
  createdByUserId: string;
  voidedAt: string | null;
  createdAt: string;
  updatedAt: string;
  expenseId: string | null;
  categoryId: string | null;
  lines: PurchaseLine[];
}

export interface ExpenseCategory {
  id: string;
  slug: string;
  name: string;
  sortOrder?: number;
  marketing: boolean;
  requiresNote: boolean;
}

export interface AdminExpense {
  id: string;
  date: string;
  amount: number;
  categoryId: string;
  category: ExpenseCategory;
  purpose: ExpensePurpose;
  vendorId: string | null;
  vendor: { id: string; name: string; phone: string | null; channel: "OFFLINE" | "ONLINE" } | null;
  paymentMethod: BooksPaymentMethod;
  notes: string | null;
  createdByUserId: string;
  purchaseId: string | null;
  orderId: string | null;
  order: { id: string; orderNumber: string } | null;
  voidedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseWritePayload {
  date: string;
  vendor: { id?: string; name?: string; phone?: string | null; channel?: "OFFLINE" | "ONLINE" };
  purpose: PurchasePurpose;
  paymentMethod: BooksPaymentMethod;
  notes?: string | null;
  shipping?: number;
  category?: string;
  lines: {
    buyItemId?: string;
    name?: string;
    unit?: BuyItemUnit;
    packSize?: number | null;
    qty: number;
    unitPrice: number;
    purpose?: PurchasePurpose;
  }[];
}

export interface ExpenseWritePayload {
  date: string;
  amount: number;
  category: string;
  purpose?: ExpensePurpose;
  paymentMethod: BooksPaymentMethod;
  notes?: string | null;
  vendor?: { id?: string; name?: string; phone?: string | null; channel?: "OFFLINE" | "ONLINE" } | null;
}

export function useAdminBuyItems(filter: { search?: string | null; page?: number; pageSize?: number }) {
  const q = filter.search?.trim() || "";
  const page = filter.page ?? 1;
  const pageSize = filter.pageSize ?? 20;
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (q) params.set("q", q);
  return useQuery<BooksPage<AdminBuyItem>>({
    queryKey: ["admin", "buy-items", { q, page, pageSize }],
    queryFn: () => api.get<BooksPage<AdminBuyItem>>(`/admin/buy-items?${params}`),
    staleTime: 15_000,
  });
}

export function useAdminBuyItem(id: string | undefined, page = 1) {
  return useQuery<AdminBuyItemDetail>({
    queryKey: ["admin", "buy-item", id, page],
    queryFn: () => api.get<AdminBuyItemDetail>(`/admin/buy-items/${id}?page=${page}&pageSize=20`),
    enabled: Boolean(id),
  });
}

export function useAdminPurchases(filter: {
  vendorId?: string | null;
  buyItemId?: string | null;
  purpose?: PurchasePurpose | null;
  page?: number;
  pageSize?: number;
}) {
  const page = filter.page ?? 1;
  const pageSize = filter.pageSize ?? 20;
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (filter.vendorId) params.set("vendorId", filter.vendorId);
  if (filter.buyItemId) params.set("buyItemId", filter.buyItemId);
  if (filter.purpose) params.set("purpose", filter.purpose);
  return useQuery<BooksPage<AdminPurchase>>({
    queryKey: ["admin", "purchases", filter],
    queryFn: () => api.get<BooksPage<AdminPurchase>>(`/admin/purchases?${params}`),
    staleTime: 15_000,
  });
}

export function useAdminPurchase(id: string | undefined) {
  return useQuery<AdminPurchase>({
    queryKey: ["admin", "purchase", id],
    queryFn: () => api.get<AdminPurchase>(`/admin/purchases/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreatePurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PurchaseWritePayload) => api.post<AdminPurchase>("/admin/purchases", body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "purchases"] });
      void qc.invalidateQueries({ queryKey: ["admin", "expenses"] });
      void qc.invalidateQueries({ queryKey: ["admin", "buy-items"] });
      void qc.invalidateQueries({ queryKey: ["admin", "vendors"] });
    },
  });
}

export function useUpdatePurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<PurchaseWritePayload>) =>
      api.patch<AdminPurchase>(`/admin/purchases/${id}`, body),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ["admin", "purchases"] });
      void qc.invalidateQueries({ queryKey: ["admin", "purchase", data.id] });
      void qc.invalidateQueries({ queryKey: ["admin", "expenses"] });
      void qc.invalidateQueries({ queryKey: ["admin", "buy-items"] });
    },
  });
}

export function useVoidPurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<AdminPurchase>(`/admin/purchases/${id}/void`, {}),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ["admin", "purchases"] });
      void qc.invalidateQueries({ queryKey: ["admin", "purchase", data.id] });
      void qc.invalidateQueries({ queryKey: ["admin", "expenses"] });
    },
  });
}

export function useExpenseCategories() {
  return useQuery<{ items: ExpenseCategory[] }>({
    queryKey: ["admin", "expense-categories"],
    queryFn: () => api.get<{ items: ExpenseCategory[] }>("/admin/expenses/categories"),
    staleTime: 60_000,
  });
}

export function useCreateExpenseCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.post<ExpenseCategory>("/admin/expenses/categories", { name }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "expense-categories"] });
    },
  });
}

export type ExpenseKindFilter = "ALL" | "BUYS" | "OTHER" | "TRIAL";

export function useAdminExpenses(filter: {
  kind?: ExpenseKindFilter;
  category?: string | null;
  from?: string | null;
  to?: string | null;
  search?: string | null;
  page?: number;
  pageSize?: number;
}) {
  const page = filter.page ?? 1;
  const pageSize = filter.pageSize ?? 20;
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (filter.kind === "TRIAL") params.set("purpose", "TRIAL");
  else if (filter.kind && filter.kind !== "ALL") params.set("kind", filter.kind);
  if (filter.category) params.set("category", filter.category);
  if (filter.from) params.set("from", filter.from);
  if (filter.to) params.set("to", filter.to);
  if (filter.search?.trim()) params.set("q", filter.search.trim());
  return useQuery<BooksPage<AdminExpense>>({
    queryKey: ["admin", "expenses", filter],
    queryFn: () => api.get<BooksPage<AdminExpense>>(`/admin/expenses?${params}`),
    staleTime: 15_000,
  });
}

export function useAdminExpense(id: string | undefined) {
  return useQuery<AdminExpense>({
    queryKey: ["admin", "expense", id],
    queryFn: () => api.get<AdminExpense>(`/admin/expenses/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ExpenseWritePayload) => api.post<AdminExpense>("/admin/expenses", body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "expenses"] });
    },
  });
}

export function useUpdateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<ExpenseWritePayload>) =>
      api.patch<AdminExpense>(`/admin/expenses/${id}`, body),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ["admin", "expenses"] });
      void qc.invalidateQueries({ queryKey: ["admin", "expense", data.id] });
    },
  });
}

export function useVoidExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<AdminExpense>(`/admin/expenses/${id}/void`, {}),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ["admin", "expenses"] });
      void qc.invalidateQueries({ queryKey: ["admin", "expense", data.id] });
      if (data.purchaseId) {
        void qc.invalidateQueries({ queryKey: ["admin", "purchases"] });
        void qc.invalidateQueries({ queryKey: ["admin", "purchase", data.purchaseId] });
      }
    },
  });
}
