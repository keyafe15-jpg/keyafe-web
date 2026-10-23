import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { PaginationControls } from "@/components/ClientPagination";
import { useAdminBuyItem } from "@/hooks/useAdminBooks";
import {
  formatBooksDate,
  inr,
  purposeLabel,
  rateCompareLabel,
  lineQtyLabel,
  packUnitLabel,
} from "@/pages/expenses/books-ui";

export function BuyItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useAdminBuyItem(id, page);
  const history = data?.history.items ?? [];
  const total = data?.history.total ?? 0;

  if (isLoading) return <p className="text-sm text-slate-500">Loading item…</p>;
  if (isError || !data) return <p className="text-sm text-red-700">Item not found.</p>;

  return (
    <div>
      <Link
        to="/items"
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-brand-500"
      >
        <ArrowLeft className="h-3 w-3" /> All items
      </Link>
      <h1 className="mt-3 text-2xl font-semibold text-slate-900">{data.name}</h1>
      <p className="mt-1 text-sm text-slate-500">
        Sold by {packUnitLabel(data.unit, data.packSize)}.
      </p>

      <div className="mt-4 overflow-clip rounded-card border border-slate-200 bg-white">
        {history.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">No buys of this item yet.</p>
        ) : (
          <>
            <ul className="divide-y divide-slate-100">
              {history.map((row) => {
                const compare = rateCompareLabel(row.vsLast, row.vsCheapest90);
                return (
                  <li key={row.id}>
                    <Link
                      to={`/expenses/buys/${row.purchaseId}`}
                      className="block px-4 py-3 hover:bg-slate-50"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="font-medium text-slate-900">{row.vendor.name}</p>
                        <p className="text-sm font-semibold text-slate-900 tabular-nums">
                          {inr(row.unitPrice)}/{packUnitLabel(data.unit, data.packSize)}
                        </p>
                      </div>
                      <p className="text-xs text-slate-500">
                        {formatBooksDate(row.date)} ·{" "}
                        {lineQtyLabel(row.qty, data.unit, data.packSize)} ·{" "}
                        {purposeLabel(row.purpose)} · {inr(row.amount)}
                      </p>
                      {compare && <p className="mt-0.5 text-xs text-amber-800">{compare}</p>}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <PaginationControls
              page={data.history.page}
              pageCount={data.history.totalPages}
              total={total}
              firstItem={total > 0 ? (data.history.page - 1) * data.history.pageSize + 1 : 0}
              lastItem={Math.min(data.history.page * data.history.pageSize, total)}
              onPageChange={setPage}
              noun="buys"
              className="mx-4 mb-4"
            />
          </>
        )}
      </div>
    </div>
  );
}
