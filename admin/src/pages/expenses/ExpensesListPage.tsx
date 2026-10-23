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
  type ExpenseKindFilter,
} from "@/hooks/useAdminBooks";
import { formatBooksDate, inr, purposeLabel } from "@/pages/expenses/books-ui";

const PAGE_SIZE = 20;

const TABS: { key: ExpenseKindFilter; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "BUYS", label: "Buys" },
  { key: "OTHER", label: "Other" },
  { key: "TRIAL", label: "Trial" },
];

export function ExpensesListPage() {
  const [page, setPage] = useState(1);
  const [kind, setKind] = useState<ExpenseKindFilter>("ALL");
  const month = monthRange(0);
  const [from, setFrom] = useState(month.from);
  const [to, setTo] = useState(month.to);
  const search = useListSearch((s) => s.query);
  const setSearch = useListSearch((s) => s.setQuery);
  const navigate = useNavigate();
  const canWrite = useStaffPermission("expenses.write");
  const searching = search.length > 0;
  const { data, isLoading, isFetching } = useAdminExpenses({
    kind,
    from: searching ? null : from,
    to: searching ? null : to,
    search: search || null,
    page,
    pageSize: PAGE_SIZE,
  });
  const rows = data?.items ?? [];
  const total = data?.total ?? 0;

  useEffect(() => {
    setPage(1);
  }, [search, kind, from, to]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Expenses</h1>
          <p className="mt-1 text-sm text-slate-500">
            {searching
              ? `${total} match${total === 1 ? "" : "es"} for “${search}”`
              : "Shop buys and the other money that left. P&L comes next."}
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
          placeholder="Search vendor, item, category, or note…"
          onDebouncedChange={setSearch}
        />
      </div>

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
            <ul className="divide-y divide-slate-100">
              {rows.map((row) => {
                const href = row.purchaseId
                  ? `/expenses/buys/${row.purchaseId}`
                  : `/expenses/${row.id}`;
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => navigate(href)}
                      className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">
                          {row.purchaseId
                            ? row.vendor?.name ?? "Shop buy"
                            : row.category.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatBooksDate(row.date)}
                          {row.purchaseId && ` · ${row.category.name}`}
                          {` · ${purposeLabel(row.purpose)}`}
                          {row.notes ? ` · ${row.notes}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900 tabular-nums">
                          {inr(row.amount)}
                        </span>
                        <ChevronRight className="h-4 w-4 text-slate-300" />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
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
