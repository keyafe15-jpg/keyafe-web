import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { PaginationControls } from "@/components/ClientPagination";
import { DebouncedSearchInput } from "@/components/form/DebouncedSearchInput";
import { useListSearch } from "@/store/listSearch";
import { useAdminBuyItems, type AdminBuyItem } from "@/hooks/useAdminBooks";
import { formatBooksDate, inr, lineQtyLabel, packUnitLabel } from "@/pages/expenses/books-ui";

const PAGE_SIZE = 20;

function timesLabel(n: number) {
  if (n <= 0) return "—";
  return n === 1 ? "1 buy" : `${n} buys`;
}

function lastRateLabel(item: AdminBuyItem) {
  if (item.lastRate == null) return "—";
  return `${inr(item.lastRate)} / ${packUnitLabel(item.unit, item.packSize)}`;
}

export function BuyItemsListPage() {
  const [page, setPage] = useState(1);
  const search = useListSearch((s) => s.query);
  const setSearch = useListSearch((s) => s.setQuery);
  const navigate = useNavigate();
  const { data, isLoading, isFetching } = useAdminBuyItems({
    search: search || null,
    page,
    pageSize: PAGE_SIZE,
  });
  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  useEffect(() => {
    setPage(1);
  }, [search]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Items</h1>
        <p className="mt-1 text-sm text-slate-500">
          {search
            ? `${total} match${total === 1 ? "" : "es"} for “${search}”`
            : "What we buy — last rate, how often, and who sold it."}
        </p>
      </div>

      <div className="mb-4">
        <DebouncedSearchInput placeholder="Search items…" onDebouncedChange={setSearch} />
      </div>

      <div className="overflow-clip rounded-card border border-slate-200 bg-white">
        {isLoading && <div className="p-8 text-center text-sm text-slate-500">Loading…</div>}
        {!isLoading && items.length === 0 && (
          <div className="p-8 text-center text-sm text-slate-500">
            {search ? `No items match “${search}”.` : "Items appear when you log a buy."}
          </div>
        )}
        {!isLoading && items.length > 0 && (
          <>
            {isFetching && !isLoading && (
              <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500">
                Updating results…
              </div>
            )}
            <table className="hidden w-full text-left text-sm md:table">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-2 font-medium">Item</th>
                  <th className="px-4 py-2 font-medium">Bought</th>
                  <th className="px-4 py-2 font-medium">Last rate</th>
                  <th className="px-4 py-2 font-medium">Last vendor</th>
                  <th className="px-4 py-2 font-medium">Last on</th>
                  <th className="px-4 py-2 text-right font-medium">Spent</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => navigate(`/items/${item.id}`)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-500">
                        {item.category?.name ? `${item.category.name} · ` : ""}
                        {packUnitLabel(item.unit, item.packSize)}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {timesLabel(item.timesBought ?? 0)}
                      {(item.totalQty ?? 0) > 0 && (
                        <p className="text-xs text-slate-500">
                          {lineQtyLabel(item.totalQty ?? 0, item.unit, item.packSize)}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-800 tabular-nums">{lastRateLabel(item)}</td>
                    <td className="max-w-[10rem] truncate px-4 py-3 text-slate-600">
                      {item.lastVendor ?? "—"}
                      {(item.vendorCount ?? 0) > 1 ? (
                        <span className="text-slate-400"> · {item.vendorCount} vendors</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      {item.lastDate ? formatBooksDate(item.lastDate) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900 tabular-nums">
                      {(item.totalSpent ?? 0) > 0 ? inr(item.totalSpent ?? 0) : "—"}
                    </td>
                    <td className="px-2 py-3 text-slate-300">
                      <ChevronRight className="h-4 w-4" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className="divide-y divide-slate-100 md:hidden">
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    to={`/items/${item.id}`}
                    className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-500">
                        {item.category?.name ? `${item.category.name} · ` : ""}
                        {packUnitLabel(item.unit, item.packSize)}
                        {(item.timesBought ?? 0) > 0 ? ` · ${timesLabel(item.timesBought ?? 0)}` : ""}
                        {item.lastRate != null ? ` · ${lastRateLabel(item)}` : ""}
                      </p>
                      {(item.timesBought ?? 0) > 0 && (
                        <p className="truncate text-xs text-slate-500">
                          {item.lastVendor}
                          {item.lastDate ? ` · ${formatBooksDate(item.lastDate)}` : ""}
                          {(item.totalSpent ?? 0) > 0 ? ` · ${inr(item.totalSpent ?? 0)} spent` : ""}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
                  </Link>
                </li>
              ))}
            </ul>

            <PaginationControls
              page={data?.page ?? 1}
              pageCount={data?.totalPages ?? 1}
              total={total}
              firstItem={data && data.total > 0 ? (data.page - 1) * data.pageSize + 1 : 0}
              lastItem={data ? Math.min(data.page * data.pageSize, data.total) : 0}
              onPageChange={setPage}
              noun="items"
              className="mx-4 mb-4"
            />
          </>
        )}
      </div>
    </div>
  );
}
