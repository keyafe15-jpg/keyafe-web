import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, ImageOff, Search, X } from "lucide-react";
import { useAdminProducts, useUpdateProduct } from "@/hooks/useAdminProducts";
import { PaginationControls } from "@/components/ClientPagination";
import { inputClass } from "@/components/form/Field";
import { cn } from "@/lib/cn";

const PAGE_SIZE = 20;

export function ProductsListPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const { data, isLoading, isFetching } = useAdminProducts(
    page,
    PAGE_SIZE,
    search,
  );
  const products = data?.items ?? [];
  const total = data?.total ?? 0;
  const navigate = useNavigate();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const searching = search.length > 0;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Products</h1>
          <p className="mt-1 text-sm text-slate-500">
            {searching
              ? `${total} match${total === 1 ? "" : "es"} for “${search}”`
              : `Full catalogue — ${total} product${total === 1 ? "" : "s"}.`}
          </p>
        </div>
        <Link
          to="/products/new"
          className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" /> New product
        </Link>
      </div>

      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name, slug, or category…"
            className={cn(inputClass, "pl-9 pr-9")}
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-card border border-slate-200 bg-white">
        {isLoading && (
          <div className="p-8 text-center text-sm text-slate-500">Loading…</div>
        )}
        {!isLoading && products.length === 0 && (
          <div className="p-8 text-center text-sm text-slate-500">
            {searching ? (
              <>No products match “{search}”.</>
            ) : (
              <>
                No products yet.{" "}
                <Link
                  to="/products/new"
                  className="text-brand-500 hover:underline"
                >
                  Add your first product
                </Link>
                .
              </>
            )}
          </div>
        )}
        {!isLoading && products.length > 0 && (
          <>
          {isFetching && !isLoading && (
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500">
              Updating results…
            </div>
          )}
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Product</th>
                <th className="px-4 py-2 font-medium">Category</th>
                <th className="px-4 py-2 font-medium text-right">Price</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => navigate(`/products/${p.id}`)}
                  className="cursor-pointer hover:bg-slate-50"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {p.images[0] ? (
                        <img
                          src={p.images[0]}
                          alt=""
                          className="h-10 w-10 shrink-0 rounded-md object-cover"
                        />
                      ) : (
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-400">
                          <ImageOff className="h-4 w-4" />
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">
                          {p.name}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          /{p.slug}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {p.category.name}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">
                    <PriceCell priceMin={p.priceMin} priceMax={p.priceMax} />
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {p.productType === "CONFIGURABLE"
                      ? "Configurable"
                      : "Variants"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadges
                      productId={p.id}
                      isActive={p.isActive}
                      isAvailable={p.isAvailable}
                      isFeatured={p.isFeatured}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <PaginationControls
            page={data?.page ?? 1}
            pageCount={data?.totalPages ?? 1}
            total={total}
            firstItem={
              data && data.total > 0
                ? (data.page - 1) * data.pageSize + 1
                : 0
            }
            lastItem={
              data ? Math.min(data.page * data.pageSize, data.total) : 0
            }
            onPageChange={setPage}
            noun="products"
            className="mx-4 mb-4"
          />
          </>
        )}
      </div>
    </div>
  );
}

function PriceCell({
  priceMin,
  priceMax,
}: {
  priceMin: number;
  priceMax: number;
}) {
  if (priceMin !== priceMax) {
    return (
      <span>
        ₹{priceMin.toFixed(0)} – ₹{priceMax.toFixed(0)}
      </span>
    );
  }
  return <span>₹{priceMin.toFixed(2)}</span>;
}

function StatusBadges({
  productId,
  isActive,
  isAvailable,
  isFeatured,
}: {
  productId: string;
  isActive: boolean;
  isAvailable: boolean;
  isFeatured: boolean;
}) {
  const update = useUpdateProduct();
  const [pending, setPending] = useState(false);

  const toggleStock = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (pending || !isActive) return;
    setPending(true);
    try {
      await update.mutateAsync({
        id: productId,
        isAvailable: !isAvailable,
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-1">
      <Chip
        active={isActive}
        label={isActive ? "Active" : "Draft"}
        tone={isActive ? "green" : "slate"}
      />
      <button
        type="button"
        onClick={toggleStock}
        disabled={!isActive || pending}
        title={
          !isActive
            ? "Activate the product before changing stock"
            : isAvailable
              ? "Mark out of stock (hidden on storefront)"
              : "Mark in stock (visible on storefront)"
        }
        className={cn(
          "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium transition",
          !isActive && "cursor-not-allowed opacity-50",
          isAvailable
            ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            : "bg-amber-50 text-amber-700 hover:bg-amber-100",
        )}
      >
        {pending ? "…" : isAvailable ? "In stock" : "Out of stock"}
      </button>
      {isFeatured && <Chip active label="Featured" tone="brand" />}
    </div>
  );
}

function Chip({
  active,
  label,
  tone,
}: {
  active: boolean;
  label: string;
  tone: "green" | "slate" | "amber" | "brand";
}) {
  const tones: Record<string, string> = {
    green: "bg-emerald-50 text-emerald-700",
    slate: "bg-slate-100 text-slate-600",
    amber: "bg-amber-50 text-amber-700",
    brand: "bg-brand-100 text-brand-700",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium",
        active ? tones[tone] : "bg-slate-100 text-slate-500",
      )}
    >
      {label}
    </span>
  );
}
