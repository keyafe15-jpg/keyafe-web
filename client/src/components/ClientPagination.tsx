import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface ClientPaginationRenderProps<T> {
  items: T[];
  page: number;
  pageCount: number;
  total: number;
  setPage: (page: number) => void;
}

export function ClientPagination<T>({
  items,
  pageSize = 12,
  resetKey,
  children,
}: {
  items: T[];
  pageSize?: number;
  resetKey?: string | number;
  children: (props: ClientPaginationRenderProps<T>) => ReactNode;
}) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paginatedItems = items.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  return children({
    items: paginatedItems,
    page: currentPage,
    pageCount,
    total: items.length,
    setPage,
  });
}

export function PaginationControls({
  page,
  pageCount,
  onPageChange,
  className,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  if (pageCount <= 1) return null;

  const goToPage = (nextPage: number) => {
    onPageChange(Math.min(Math.max(1, nextPage), pageCount));
  };

  return (
    <div
      className={cn("mt-8 flex items-center justify-center gap-2", className)}
    >
      <button
        type="button"
        onClick={() => goToPage(page - 1)}
        disabled={page <= 1}
        className="h-8 min-w-[72px] rounded-full border border-cream-200 bg-white px-2.5 text-xs font-medium text-ink-700 transition hover:border-brand-200 hover:text-brand-600 disabled:cursor-not-allowed disabled:border-cream-100 disabled:text-ink-300"
      >
        Prev
      </button>

      <div className="rounded-full border border-cream-200 bg-cream-50 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-ink-500">
        {page}/{pageCount}
      </div>

      <button
        type="button"
        onClick={() => goToPage(page + 1)}
        disabled={page >= pageCount}
        className="h-8 min-w-[72px] rounded-full border border-brand-200 bg-brand-50 px-2.5 text-xs font-medium text-brand-700 transition hover:bg-brand-100 disabled:cursor-not-allowed disabled:border-cream-100 disabled:bg-cream-50 disabled:text-ink-300"
      >
        Next
      </button>
    </div>
  );
}
