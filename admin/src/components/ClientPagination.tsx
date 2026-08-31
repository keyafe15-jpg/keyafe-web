import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface ClientPaginationRenderProps<T> {
  items: T[];
  page: number;
  pageCount: number;
  total: number;
  firstItem: number;
  lastItem: number;
  setPage: (page: number) => void;
}

export function ClientPagination<T>({
  items,
  pageSize = 10,
  resetKey,
  className,
  children,
}: {
  items: T[];
  pageSize?: number;
  resetKey?: string | number;
  className?: string;
  children: (props: ClientPaginationRenderProps<T>) => ReactNode;
}) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paginatedItems = items.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const firstItem = items.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const lastItem = Math.min(currentPage * pageSize, items.length);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  return (
    <div className={className}>
      {children({
        items: paginatedItems,
        page: currentPage,
        pageCount,
        total: items.length,
        firstItem,
        lastItem,
        setPage,
      })}
    </div>
  );
}

export function PaginationControls({
  page,
  pageCount,
  total,
  firstItem,
  lastItem,
  onPageChange,
  noun = "items",
  className,
}: {
  page: number;
  pageCount: number;
  total: number;
  firstItem: number;
  lastItem: number;
  onPageChange: (page: number) => void;
  noun?: string;
  className?: string;
}) {
  if (total === 0) return null;

  return (
    <div
      className={cn(
        "mt-4 flex flex-col gap-3 rounded-card border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <p>
        Showing <span className="font-medium text-slate-900">{firstItem}</span>-
        <span className="font-medium text-slate-900">{lastItem}</span> of{" "}
        <span className="font-medium text-slate-900">{total}</span> {noun}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>
        <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
          {page} / {pageCount}
        </span>
        <button
          type="button"
          disabled={page === pageCount}
          onClick={() => onPageChange(page + 1)}
          className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
