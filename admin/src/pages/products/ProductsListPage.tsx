import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, ImageOff, Search, X, Copy, Archive, ArchiveRestore, Trash2 } from "lucide-react";
import {
  useAdminProducts,
  useArchiveProduct,
  useDeleteProduct,
  useDuplicateProduct,
  useUnarchiveProduct,
  useUpdateProduct,
  type AdminProductListScope,
} from "@/hooks/useAdminProducts";
import { PaginationControls } from "@/components/ClientPagination";
import { inputClass } from "@/components/form/Field";
import { cn } from "@/lib/cn";

const PAGE_SIZE = 20;

const SCOPES: { id: AdminProductListScope; label: string }[] = [
  { id: "catalog", label: "Catalogue" },
  { id: "archived", label: "Archived" },
  { id: "all", label: "All" },
];

export function ProductsListPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<AdminProductListScope>("catalog");
  const { data, isLoading, isFetching } = useAdminProducts(page, PAGE_SIZE, search, scope);
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
              : scope === "archived"
                ? `${total} archived product${total === 1 ? "" : "s"}.`
                : scope === "all"
                  ? `${total} product${total === 1 ? "" : "s"} total.`
                  : `Catalogue — ${total} product${total === 1 ? "" : "s"}.`}
          </p>
        </div>
        <Link
          to="/products/new"
          className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" /> New product
        </Link>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
          {SCOPES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setScope(s.id);
                setPage(1);
              }}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition",
                scope === s.id
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="relative max-w-md flex-1 sm:max-w-sm sm:flex-none">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name, slug, or category…"
            className={cn(inputClass, "pr-9 pl-9")}
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput("")}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-card border border-slate-200 bg-white">
        {isLoading && <div className="p-8 text-center text-sm text-slate-500">Loading…</div>}
        {!isLoading && products.length === 0 && (
          <div className="p-8 text-center text-sm text-slate-500">
            {searching ? (
              <>No products match “{search}”.</>
            ) : scope === "archived" ? (
              <>No archived products.</>
            ) : (
              <>
                No products yet.{" "}
                <Link to="/products/new" className="text-brand-500 hover:underline">
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
            <table className="hidden w-full text-left text-sm md:table">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-2 font-medium">Product</th>
                  <th className="px-4 py-2 font-medium">Category</th>
                  <th className="px-4 py-2 text-right font-medium">Price</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 text-right font-medium">Actions</th>
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
                          <p className="truncate font-medium text-slate-900">{p.name}</p>
                          <p className="truncate text-xs text-slate-500">/{p.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {p.categories.map((c) => c.name).join(" · ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      <PriceCell priceMin={p.priceMin} priceMax={p.priceMax} />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {p.productType === "CONFIGURABLE" ? "Configurable" : "Variants"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadges
                        productId={p.id}
                        isActive={p.isActive}
                        isAvailable={p.isAvailable}
                        isFeatured={p.isFeatured}
                        isArchived={Boolean(p.archivedAt)}
                      />
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <ProductRowActions
                        productId={p.id}
                        productName={p.name}
                        isArchived={Boolean(p.archivedAt)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className="divide-y divide-slate-100 md:hidden">
              {products.map((p) => (
                <li
                  key={p.id}
                  className="relative px-4 py-3 transition focus-within:bg-slate-50 hover:bg-slate-50"
                >
                  <Link
                    to={`/products/${p.id}`}
                    className="absolute inset-0"
                    aria-label={`Open ${p.name}`}
                  />
                  <div className="pointer-events-none relative flex items-start gap-3">
                    {p.images[0] ? (
                      <img
                        src={p.images[0]}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-md object-cover"
                      />
                    ) : (
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-400">
                        <ImageOff className="h-4 w-4" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate font-medium text-slate-900">{p.name}</p>
                        <span className="shrink-0 text-sm font-semibold text-slate-900 tabular-nums">
                          <PriceCell priceMin={p.priceMin} priceMax={p.priceMax} />
                        </span>
                      </div>
                      <p className="truncate text-xs text-slate-500">/{p.slug}</p>
                      <p className="mt-1 truncate text-xs text-slate-600">
                        {p.categories.map((c) => c.name).join(" · ") || "Uncategorised"}
                      </p>
                      <div className="pointer-events-auto mt-2 flex flex-wrap items-center gap-1">
                        <StatusBadges
                          productId={p.id}
                          isActive={p.isActive}
                          isAvailable={p.isAvailable}
                          isFeatured={p.isFeatured}
                          isArchived={Boolean(p.archivedAt)}
                        />
                        <span className="text-[10px] text-slate-400">
                          {p.productType === "CONFIGURABLE" ? "Configurable" : "Variants"}
                        </span>
                        <ProductRowActions
                          productId={p.id}
                          productName={p.name}
                          isArchived={Boolean(p.archivedAt)}
                        />
                      </div>
                    </div>
                  </div>
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
              noun="products"
              className="mx-4 mb-4"
            />
          </>
        )}
      </div>
    </div>
  );
}

function PriceCell({ priceMin, priceMax }: { priceMin: number; priceMax: number }) {
  if (priceMin !== priceMax) {
    return (
      <span>
        ₹{priceMin.toFixed(0)} – ₹{priceMax.toFixed(0)}
      </span>
    );
  }
  return <span>₹{priceMin.toFixed(2)}</span>;
}

const actionBtnClass =
  "inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60";

function ProductRowActions({
  productId,
  productName,
  isArchived,
}: {
  productId: string;
  productName: string;
  isArchived: boolean;
}) {
  const navigate = useNavigate();
  const duplicate = useDuplicateProduct();
  const archive = useArchiveProduct();
  const unarchive = useUnarchiveProduct();
  const del = useDeleteProduct();
  const [error, setError] = useState<string | null>(null);
  const pending =
    duplicate.isPending || archive.isPending || unarchive.isPending || del.isPending;

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    }
  };

  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <span className="inline-flex flex-wrap justify-end gap-1">
        {!isArchived && (
          <button
            type="button"
            disabled={pending}
            title={`Duplicate “${productName}” as a draft`}
            className={actionBtnClass}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void run(async () => {
                const created = await duplicate.mutateAsync(productId);
                navigate(`/products/${created.id}`, { state: { fromDuplicate: true } });
              });
            }}
          >
            <Copy className="h-3 w-3" />
            {duplicate.isPending ? "…" : "Duplicate"}
          </button>
        )}
        {isArchived ? (
          <button
            type="button"
            disabled={pending}
            title="Restore to catalogue as a draft"
            className={actionBtnClass}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void run(async () => {
                await unarchive.mutateAsync(productId);
              });
            }}
          >
            <ArchiveRestore className="h-3 w-3" />
            {unarchive.isPending ? "…" : "Unarchive"}
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            title="Hide from catalogue (can restore later)"
            className={actionBtnClass}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!confirm(`Archive “${productName}”? It will leave the storefront catalogue.`)) {
                return;
              }
              void run(async () => {
                await archive.mutateAsync(productId);
              });
            }}
          >
            <Archive className="h-3 w-3" />
            {archive.isPending ? "…" : "Archive"}
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          title="Permanently delete"
          className={cn(actionBtnClass, "border-red-200 text-red-700 hover:bg-red-50")}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (
              !confirm(
                `Permanently delete “${productName}”? Past orders keep their snapshots; this cannot be undone.`,
              )
            ) {
              return;
            }
            void run(async () => {
              await del.mutateAsync(productId);
            });
          }}
        >
          <Trash2 className="h-3 w-3" />
          {del.isPending ? "…" : "Delete"}
        </button>
      </span>
      {error && <span className="max-w-[12rem] text-right text-[10px] text-brand-700">{error}</span>}
    </span>
  );
}

function StatusBadges({
  productId,
  isActive,
  isAvailable,
  isFeatured,
  isArchived,
}: {
  productId: string;
  isActive: boolean;
  isAvailable: boolean;
  isFeatured: boolean;
  isArchived: boolean;
}) {
  const update = useUpdateProduct();
  const [pending, setPending] = useState(false);

  const toggleStock = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (pending || !isActive || isArchived) return;
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

  if (isArchived) {
    return (
      <div className="flex flex-wrap gap-1">
        <Chip active label="Archived" tone="amber" />
      </div>
    );
  }

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
