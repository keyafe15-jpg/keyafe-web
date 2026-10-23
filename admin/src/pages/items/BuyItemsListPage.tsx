import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { PaginationControls } from "@/components/ClientPagination";
import { useListSearch } from "@/store/listSearch";
import { useAdminBuyItems } from "@/hooks/useAdminBooks";
import { packUnitLabel } from "@/pages/expenses/books-ui";

const PAGE_SIZE = 20;

export function BuyItemsListPage() {
  const [page, setPage] = useState(1);
  const search = useListSearch((s) => s.query);
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
          What we buy — tap for price history across vendors.
        </p>
      </div>

      <div className="overflow-clip rounded-card border border-slate-200 bg-white">
        {isLoading && <div className="p-8 text-center text-sm text-slate-500">Loading…</div>}
        {!isLoading && items.length === 0 && (
          <div className="p-8 text-center text-sm text-slate-500">
            {search
              ? `No items match “${search}”.`
              : "Items appear when you log a buy."}
          </div>
        )}
        {!isLoading && items.length > 0 && (
          <>
            {isFetching && !isLoading && (
              <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500">
                Updating results…
              </div>
            )}
            <ul className="divide-y divide-slate-100">
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    to={`/items/${item.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-500">
                        {packUnitLabel(item.unit, item.packSize)}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-300" />
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
