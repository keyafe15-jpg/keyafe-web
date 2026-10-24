import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
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
  sum?: number;
}

export interface ExpenseCategoryTotal {
  id: string;
  slug: string;
  name: string;
  total: number;
  count: number;
  masked?: boolean;
}

export interface ExpenseRangeSummary {
  total: number;
  count: number;
  buys: number;
  delivery: number;
  other: number;
  maskSalaries?: boolean;
  byCategory: ExpenseCategoryTotal[];
}

export interface BooksPrivacy {
  maskSalaries: boolean;
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
  categoryId?: string | null;
  category?: { id: string; slug: string; name: string } | null;
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
  categoryId?: string | null;
  category?: { id: string; slug: string; name: string } | null;
  buyItem: {
    id: string;
    name: string;
    unit: BuyItemUnit;
    packSize: number | null;
    categoryId?: string | null;
    category?: { id: string; slug: string; name: string } | null;
  };
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
  miscCharges: number;
  total: number;
  createdByUserId: string;
  paidById: string | null;
  paidBy: BooksPayer | null;
  voidedAt: string | null;
  createdAt: string;
  updatedAt: string;
  expenseId: string | null;
  categoryId: string | null;
  lines: PurchaseLine[];
}

export interface BooksPayer {
  id: string;
  name: string;
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
  amount: number | null;
  amountMasked?: boolean;
  categoryId: string;
  category: ExpenseCategory;
  purpose: ExpensePurpose;
  vendorId: string | null;
  vendor: { id: string; name: string; phone: string | null; channel: "OFFLINE" | "ONLINE" } | null;
  paymentMethod: BooksPaymentMethod;
  notes: string | null;
  createdByUserId: string;
  paidById: string | null;
  paidBy: BooksPayer | null;
  paidTo: string | null;
  purchaseId: string | null;
  orderId: string | null;
  order: { id: string; orderNumber: string } | null;
  buy: { lineCount: number; items: string[]; shipping: number; miscCharges: number } | null;
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
  miscCharges?: number;
  category?: string;
  paidBy?: string | null;
  lines: {
    buyItemId?: string;
    name?: string;
    unit?: BuyItemUnit;
    packSize?: number | null;
    category?: string;
    qty: number;
    unitPrice: number;
    purpose?: PurchasePurpose;
  }[];
}

export interface ExpenseWritePayload {
  date: string;
  amount?: number;
  category: string;
  purpose?: ExpensePurpose;
  paymentMethod: BooksPaymentMethod;
  notes?: string | null;
  vendor?: { id?: string; name?: string; phone?: string | null; channel?: "OFFLINE" | "ONLINE" } | null;
  paidBy?: string | null;
  paidTo?: string | null;
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

export function useUpdateBuyItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, category }: { id: string; category: string }) =>
      api.patch<AdminBuyItem>(`/admin/buy-items/${id}`, { category }),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ["admin", "buy-items"] });
      void qc.invalidateQueries({ queryKey: ["admin", "buy-item", data.id] });
    },
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

function invalidateBooks(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: ["admin", "purchases"] });
  void qc.invalidateQueries({ queryKey: ["admin", "purchase"] });
  void qc.invalidateQueries({ queryKey: ["admin", "expenses"] });
  void qc.invalidateQueries({ queryKey: ["admin", "expense"] });
  void qc.invalidateQueries({ queryKey: ["admin", "buy-items"] });
  void qc.invalidateQueries({ queryKey: ["admin", "buy-item"] });
  void qc.invalidateQueries({ queryKey: ["admin", "vendors"] });
}

export function useVoidPurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<AdminPurchase>(`/admin/purchases/${id}/void`, {}),
    onSuccess: () => invalidateBooks(qc),
  });
}

export function useExpenseCategories() {
  return useQuery<{ items: ExpenseCategory[] }>({
    queryKey: ["admin", "expense-categories"],
    queryFn: () => api.get<{ items: ExpenseCategory[] }>("/admin/expenses/categories"),
    staleTime: 60_000,
  });
}

export function useBooksPayers() {
  return useQuery<{ items: BooksPayer[] }>({
    queryKey: ["admin", "books-payers"],
    queryFn: async () => {
      try {
        return await api.get<{ items: BooksPayer[] }>("/admin/expenses/payers");
      } catch {
        return api.get<{ items: BooksPayer[] }>("/admin/orders/payers");
      }
    },
    staleTime: 60_000,
  });
}

export function useCreateBooksPayer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      try {
        return await api.post<BooksPayer>("/admin/expenses/payers", { name });
      } catch {
        return api.post<BooksPayer>("/admin/orders/payers", { name });
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "books-payers"] });
    },
  });
}

export function useSalaryPayees() {
  return useQuery<{ items: string[] }>({
    queryKey: ["admin", "salary-payees"],
    queryFn: () => api.get<{ items: string[] }>("/admin/expenses/salary-payees"),
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
  return useQuery<BooksPage<AdminExpense> & { sum: number; sumMasked?: boolean; maskSalaries?: boolean }>({
    queryKey: ["admin", "expenses", filter],
    queryFn: () =>
      api.get<BooksPage<AdminExpense> & { sum: number; sumMasked?: boolean; maskSalaries?: boolean }>(
        `/admin/expenses?${params}`,
      ),
    staleTime: 15_000,
  });
}

export function useBooksPrivacy(enabled = true) {
  return useQuery<BooksPrivacy>({
    queryKey: ["admin", "business", "books-privacy"],
    queryFn: () => api.get<BooksPrivacy>("/admin/business/books-privacy"),
    staleTime: 15_000,
    enabled,
  });
}

export function useUpdateBooksPrivacy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BooksPrivacy) =>
      api.patch<BooksPrivacy>("/admin/business/books-privacy", input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "business", "books-privacy"] });
      void qc.invalidateQueries({ queryKey: ["admin", "expenses"] });
      void qc.invalidateQueries({ queryKey: ["admin", "expense"] });
    },
  });
}

export function useExpenseSummary(from: string, to: string, enabled = true) {
  return useQuery<ExpenseRangeSummary>({
    queryKey: ["admin", "expenses", "summary", from, to],
    queryFn: () =>
      api.get<ExpenseRangeSummary>(
        `/admin/expenses/summary?${new URLSearchParams({ from, to }).toString()}`,
      ),
    staleTime: 30_000,
    enabled: enabled && !!from && !!to,
  });
}

export type ReceiptParseKind = "BUY" | "EXPENSE";

export interface ReceiptDraftLine {
  buyItemId?: string;
  name: string;
  unit: BuyItemUnit;
  packSize: number | null;
  category?: string;
  qty: number;
  unitPrice: number;
}

export interface ReceiptDraft {
  kind: ReceiptParseKind;
  looksLikeBuy: boolean;
  uncertain: boolean;
  date: string | null;
  vendorId: string | null;
  vendorName: string | null;
  vendorChannel: "ONLINE" | "OFFLINE";
  category: string | null;
  paymentMethod: BooksPaymentMethod | null;
  shipping: number;
  miscCharges: number;
  amount: number | null;
  notes: string | null;
  lines: ReceiptDraftLine[];
}

export function useParseReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { kind: ReceiptParseKind; image: File; context?: string }) => {
      const { compressSuggestImage } = await import("@/ai/compressSuggestImage");
      const image = await compressSuggestImage(input.image);
      const form = new FormData();
      form.append("kind", input.kind);
      form.append("image", image);
      if (input.context?.trim()) form.append("context", input.context.trim().slice(0, 400));
      return api.postForm<ReceiptDraft>("/admin/expenses/parse-receipt", form);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "vendors"] });
    },
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
      void qc.invalidateQueries({ queryKey: ["admin", "salary-payees"] });
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
      void qc.invalidateQueries({ queryKey: ["admin", "salary-payees"] });
    },
  });
}

export function useVoidExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<AdminExpense>(`/admin/expenses/${id}/void`, {}),
    onSuccess: (data) => {
      invalidateBooks(qc);
      if (data.orderId) {
        void qc.invalidateQueries({ queryKey: ["admin", "orders"] });
        void qc.invalidateQueries({ queryKey: ["admin", "order", data.orderId] });
      }
    },
  });
}

export function useDeleteBooksRow() {
  const voidBuy = useVoidPurchase();
  const voidExp = useVoidExpense();
  return {
    pending: voidBuy.isPending || voidExp.isPending,
    deleteExpense: (row: Pick<AdminExpense, "id" | "purchaseId" | "orderId">) => {
      if (row.purchaseId) return voidBuy.mutateAsync(row.purchaseId).then(() => undefined);
      return voidExp.mutateAsync(row.id).then(() => undefined);
    },
    deleteBuy: (purchaseId: string) => voidBuy.mutateAsync(purchaseId).then(() => undefined),
  };
}
