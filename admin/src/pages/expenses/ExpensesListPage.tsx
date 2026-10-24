import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, Plus } from "lucide-react";
import { PaginationControls } from "@/components/ClientPagination";
import { DebouncedSearchInput } from "@/components/form/DebouncedSearchInput";
import { useListSearch } from "@/store/listSearch";
import { useStaffPermission } from "@/lib/permissions";
import { monthRange } from "@/lib/dateRange";
import { cn } from "@/lib/cn";
import { inputClass } from "@/components/form/Field";
import {
  useAdminExpenses,
  useDeleteBooksRow,
  useExpenseSummary,
  type AdminExpense,
  type ExpenseKindFilter,
} from "@/hooks/useAdminBooks";
import {
  booksDeleteConfirm,
  formatBooksDate,
  inr,
  isSalaryCategory,
  payLabel,
  purposeLabel,
} from "@/pages/expenses/books-ui";
import { BooksDeleteButton } from "@/pages/expenses/BooksDeleteButton";

const PAGE_SIZE = 20;

function expenseHref(row: AdminExpense) {
  if (row.purchaseId) return `/expenses/buys/${row.purchaseId}`;
  if (row.orderId) return `/orders/${row.orderId}`;
  return `/expenses/${row.id}`;
}

function expenseTitle(row: AdminExpense) {
  if (row.buy) return row.vendor?.name ?? "Shop buy";
  if (row.order) return `Delivery · ${row.order.orderNumber}`;
  if (isSalaryCategory(row.category) && row.paidTo) return row.paidTo;
  return row.category.name;
}

function itemsPreview(row: AdminExpense) {
  if (row.buy) {
    const names = row.buy.items;
    const shown = names.slice(0, 2).join(", ");
    const more = names.length > 2 ? ` +${names.length - 2}` : "";
    const count = row.buy.lineCount === 1 ? "1 item" : `${row.buy.lineCount} items`;
    const ship = row.buy.shipping > 0 ? ` · ship ${inr(row.buy.shipping)}` : "";
    const misc = row.buy.miscCharges > 0 ? ` · misc ${inr(row.buy.miscCharges)}` : "";
    return `${count}${shown ? ` · ${shown}${more}` : ""}${ship}${misc}`;
  }
  if (row.order) return "Order delivery";
  return row.notes || "—";
}

const TABS: { key: ExpenseKindFilter; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "BUYS", label: "Buys" },
  { key: "OTHER", label: "Other" },
  { key: "TRIAL", label: "Trial" },
];

export function ExpensesListPage() {
  const [page, setPage] = useState(1);
  const [kind, setKind] = useState<ExpenseKindFilter>("ALL");
  const [category, setCategory] = useState<string | null>(null);
  const month = monthRange(0);
  const [from, setFrom] = useState(month.from);
  const [to, setTo] = useState(month.to);
  const search = useListSearch((s) => s.query);
  const setSearch = useListSearch((s) => s.setQuery);
  const navigate = useNavigate();
  const canWrite = useStaffPermission("expenses.write");
  const remove = useDeleteBooksRow();
  const [error, setError] = useState<string | null>(null);

  const deleteRow = (row: AdminExpense) => {
    setError(null);
    return remove.deleteExpense(row).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Could not delete");
    });
  };
  const searching = search.length > 0;
  const { data, isLoading, isFetching } = useAdminExpenses({
    kind,
    category: searching ? null : category,
    from: searching ? null : from,
    to: searching ? null : to,
    search: search || null,
    page,
    pageSize: PAGE_SIZE,
  });
  const summary = useExpenseSummary(from, to, !searching);
  const categoryTotals = summary.data?.byCategory ?? [];
  const rows = data?.items ?? [];
  const total = data?.total ?? 0;

  useEffect(() => {
    setPage(1);
  }, [search, kind, category, from, to]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Expenses</h1>
          <p className="mt-1 text-sm text-slate-500">
            {searching
              ? `${total} match${total === 1 ? "" : "es"} for “${search}”`
              : `${total} in this range`}
            {data ? ` · ${inr(data.sum ?? 0)}` : ""}
          </p>
        </div>
        {canWrite && (
          <div className="flex flex-wrap gap-2">
            <Link
              to="/expenses/new"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Log expense
            </Link>
            <Link
              to="/expenses/new-buy"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              <Plus className="h-4 w-4" /> Log a buy
            </Link>
          </div>
        )}
      </div>

      <div className="mb-3">
        <DebouncedSearchInput
          placeholder="Search vendor, person, item, category, or note…"
          onDebouncedChange={setSearch}
        />
      </div>

      {!searching && categoryTotals.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {categoryTotals.map((row) => {
            const active = category === row.slug || category === row.id;
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => setCategory(active ? null : row.slug)}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-medium transition",
                  active
                    ? "bg-brand-50 border-brand-500 text-brand-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                )}
              >
                {row.name}{" "}
                <span className="tabular-nums">{inr(row.total)}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setKind(t.key)}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs font-medium transition",
              kind === t.key
                ? "bg-brand-50 border-brand-500 text-brand-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="mb-3 text-sm text-red-700">{error}</p>}

      {!searching && (
        <div className="mb-4 flex flex-wrap gap-2">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={cn(inputClass, "w-auto")}
          />
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className={cn(inputClass, "w-auto")}
          />
        </div>
      )}

      <div className="overflow-clip rounded-card border border-slate-200 bg-white">
        {isLoading && <div className="p-8 text-center text-sm text-slate-500">Loading…</div>}
        {!isLoading && rows.length === 0 && (
          <div className="p-8 text-center text-sm text-slate-500">
            {search
              ? `No expenses match “${search}”.`
              : "Nothing in this range. Log tonight’s shop run."}
          </div>
        )}
        {!isLoading && rows.length > 0 && (
          <>
            {isFetching && !isLoading && (
              <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500">
                Updating results…
              </div>
            )}
            <table className="hidden w-full text-left text-sm md:table">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-2 font-medium">When</th>
                  <th className="px-4 py-2 font-medium">Who / what</th>
                  <th className="px-4 py-2 font-medium">Lines</th>
                  <th className="px-4 py-2 font-medium">Paid</th>
                  <th className="px-4 py-2 text-right font-medium">Amount</th>
                  {canWrite && <th className="w-10" />}
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => navigate(expenseHref(row))}
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                      {formatBooksDate(row.date)}
                      <p className="text-xs text-slate-500">{purposeLabel(row.purpose)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{expenseTitle(row)}</p>
                      <p className="text-xs text-slate-500">
                        {row.buy ? row.category.name : row.notes || row.category.name}
                      </p>
                    </td>
                    <td className="max-w-[18rem] px-4 py-3 text-slate-600">
                      {itemsPreview(row)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {payLabel(row.paymentMethod)}
                      {row.paidBy ? ` · ${row.paidBy.name}` : ""}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900 tabular-nums">
                      {inr(row.amount)}
                    </td>
                    {canWrite && (
                      <td className="px-1 py-3" onClick={(e) => e.stopPropagation()}>
                        <BooksDeleteButton
                          confirm={booksDeleteConfirm(
                            row.purchaseId ? "buy" : row.orderId ? "delivery" : "expense",
                          )}
                          pending={remove.pending}
                          onDelete={() => deleteRow(row)}
                        />
                      </td>
                    )}
                    <td className="px-2 py-3 text-slate-300">
                      <ChevronRight className="h-4 w-4" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className="divide-y divide-slate-100 md:hidden">
              {rows.map((row) => (
                <li key={row.id} className="flex items-start">
                  <button
                    type="button"
                    onClick={() => navigate(expenseHref(row))}
                    className="flex min-w-0 flex-1 items-start justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">{expenseTitle(row)}</p>
                      <p className="text-xs text-slate-500">
                        {formatBooksDate(row.date)} · {purposeLabel(row.purpose)}
                        {row.buy ? ` · ${row.category.name}` : ""}
                        {row.paidBy ? ` · ${row.paidBy.name}` : ""}
                      </p>
                      <p className="truncate text-xs text-slate-500">{itemsPreview(row)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900 tabular-nums">
                        {inr(row.amount)}
                      </span>
                      <ChevronRight className="h-4 w-4 text-slate-300" />
                    </div>
                  </button>
                  {canWrite && (
                    <div className="shrink-0 py-3 pr-3">
                      <BooksDeleteButton
                        confirm={booksDeleteConfirm(
                          row.purchaseId ? "buy" : row.orderId ? "delivery" : "expense",
                        )}
                        pending={remove.pending}
                        onDelete={() => deleteRow(row)}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm">
              <span className="text-slate-500">
                {searching ? "Matching total" : "Range total"}
              </span>
              <span className="font-semibold text-slate-900 tabular-nums">
                {inr(data?.sum ?? 0)}
              </span>
            </div>
            <PaginationControls
              page={data?.page ?? 1}
              pageCount={data?.totalPages ?? 1}
              total={total}
              firstItem={data && data.total > 0 ? (data.page - 1) * data.pageSize + 1 : 0}
              lastItem={data ? Math.min(data.page * data.pageSize, data.total) : 0}
              onPageChange={setPage}
              noun="expenses"
              className="mx-4 mb-4"
            />
          </>
        )}
      </div>
    </div>
  );
}
