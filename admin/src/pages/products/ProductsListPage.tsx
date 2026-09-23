import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Plus,
  ImageOff,
  Search,
  X,
  Copy,
  Archive,
  ArchiveRestore,
  Trash2,
  MoreVertical,
  Pencil,
} from "lucide-react";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
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
                  <th className="px-4 py-2 text-right font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
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
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <StatusToggles
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
                        isActive={p.isActive}
                        isAvailable={p.isAvailable}
                        isFeatured={p.isFeatured}
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
                      <div className="pointer-events-auto mt-2 flex flex-wrap items-center justify-between gap-2">
                        <StatusToggles
                          productId={p.id}
                          isActive={p.isActive}
                          isAvailable={p.isAvailable}
                          isFeatured={p.isFeatured}
                          isArchived={Boolean(p.archivedAt)}
                        />
                        <ProductRowActions
                          productId={p.id}
                          productName={p.name}
                          isArchived={Boolean(p.archivedAt)}
                          isActive={p.isActive}
                          isAvailable={p.isAvailable}
                          isFeatured={p.isFeatured}
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

const iconBtnClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50";

function ProductRowActions({
  productId,
  productName,
  isArchived,
  isActive,
  isAvailable,
  isFeatured,
}: {
  productId: string;
  productName: string;
  isArchived: boolean;
  isActive: boolean;
  isAvailable: boolean;
  isFeatured: boolean;
}) {
  const navigate = useNavigate();
  const duplicate = useDuplicateProduct();
  const archive = useArchiveProduct();
  const unarchive = useUnarchiveProduct();
  const del = useDeleteProduct();
  const update = useUpdateProduct();
  const [error, setError] = useState<string | null>(null);
  const [statusPending, setStatusPending] = useState(false);
  const pending =
    duplicate.isPending ||
    archive.isPending ||
    unarchive.isPending ||
    del.isPending ||
    statusPending;

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    }
  };

  const patchStatus = async (data: {
    isActive?: boolean;
    isAvailable?: boolean;
    isFeatured?: boolean;
  }) => {
    setStatusPending(true);
    setError(null);
    try {
      await update.mutateAsync({ id: productId, ...data });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status update failed");
    } finally {
      setStatusPending(false);
    }
  };

  const menuItemClass =
    "flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-700 outline-none hover:bg-slate-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50";

  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <span className="inline-flex items-center gap-0.5">
        {isArchived ? (
          <button
            type="button"
            disabled={pending}
            title="Unarchive"
            aria-label={`Unarchive ${productName}`}
            className={iconBtnClass}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void run(async () => {
                await unarchive.mutateAsync(productId);
              });
            }}
          >
            <ArchiveRestore className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            title="Archive"
            aria-label={`Archive ${productName}`}
            className={iconBtnClass}
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
            <Archive className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          title="Delete"
          aria-label={`Delete ${productName}`}
          className={cn(iconBtnClass, "text-red-500 hover:bg-red-50 hover:text-red-700")}
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
          <Trash2 className="h-4 w-4" />
        </button>

        <Dropdown.Root>
          <Dropdown.Trigger asChild>
            <button
              type="button"
              disabled={pending}
              title="More actions"
              aria-label={`More actions for ${productName}`}
              className={iconBtnClass}
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </Dropdown.Trigger>
          <Dropdown.Portal>
            <Dropdown.Content
              align="end"
              sideOffset={4}
              className="z-40 min-w-[200px] rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <Dropdown.Item
                className={menuItemClass}
                onSelect={() => navigate(`/products/${productId}`)}
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Dropdown.Item>
              {!isArchived && (
                <Dropdown.Item
                  className={menuItemClass}
                  disabled={duplicate.isPending}
                  onSelect={() => {
                    void run(async () => {
                      const created = await duplicate.mutateAsync(productId);
                      navigate(`/products/${created.id}`, { state: { fromDuplicate: true } });
                    });
                  }}
                >
                  <Copy className="h-3.5 w-3.5" /> Duplicate
                </Dropdown.Item>
              )}

              {!isArchived && (
                <>
                  <Dropdown.Separator className="my-1 h-px bg-slate-100" />
                  <Dropdown.Label className="px-3 py-1 text-[10px] font-medium tracking-wide text-slate-400 uppercase">
                    Status
                  </Dropdown.Label>
                  <Dropdown.Item
                    className={menuItemClass}
                    disabled={statusPending}
                    onSelect={() => {
                      void patchStatus({ isActive: !isActive });
                    }}
                  >
                    {isActive ? "Set as draft" : "Set as active"}
                  </Dropdown.Item>
                  <Dropdown.Item
                    className={menuItemClass}
                    disabled={statusPending || !isActive}
                    onSelect={() => {
                      if (!isActive) return;
                      void patchStatus({ isAvailable: !isAvailable });
                    }}
                  >
                    {isAvailable ? "Mark out of stock" : "Mark in stock"}
                  </Dropdown.Item>
                  <Dropdown.Item
                    className={menuItemClass}
                    disabled={statusPending}
                    onSelect={() => {
                      void patchStatus({ isFeatured: !isFeatured });
                    }}
                  >
                    {isFeatured ? "Remove from featured" : "Mark as featured"}
                  </Dropdown.Item>
                </>
              )}
            </Dropdown.Content>
          </Dropdown.Portal>
        </Dropdown.Root>
      </span>
      {error && <span className="max-w-[12rem] text-right text-[10px] text-brand-700">{error}</span>}
    </span>
  );
}

function StatusToggles({
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
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const patch = async (
    key: string,
    data: { isActive?: boolean; isAvailable?: boolean; isFeatured?: boolean },
  ) => {
    if (pendingKey || isArchived) return;
    setPendingKey(key);
    try {
      await update.mutateAsync({ id: productId, ...data });
    } finally {
      setPendingKey(null);
    }
  };

  if (isArchived) {
    return (
      <span className="inline-flex items-center rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
        Archived
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      <StatusToggle
        active={isActive}
        pending={pendingKey === "active"}
        labelOn="Active"
        labelOff="Draft"
        titleOn="Click to set as draft (hidden from catalogue)"
        titleOff="Click to activate (show in catalogue)"
        tone="green"
        onClick={() => void patch("active", { isActive: !isActive })}
      />
      <StatusToggle
        active={isAvailable}
        pending={pendingKey === "stock"}
        disabled={!isActive}
        labelOn="In stock"
        labelOff="Out of stock"
        titleOn={
          isActive
            ? "Click to mark out of stock"
            : "Activate the product before changing stock"
        }
        titleOff={
          isActive ? "Click to mark in stock" : "Activate the product before changing stock"
        }
        tone="emerald"
        onClick={() => {
          if (!isActive) return;
          void patch("stock", { isAvailable: !isAvailable });
        }}
      />
      <StatusToggle
        active={isFeatured}
        pending={pendingKey === "featured"}
        labelOn="Featured"
        labelOff="Featured"
        titleOn="Click to remove from featured"
        titleOff="Click to feature this product"
        tone="brand"
        dimWhenOff
        onClick={() => void patch("featured", { isFeatured: !isFeatured })}
      />
    </div>
  );
}

function StatusToggle({
  active,
  pending,
  disabled,
  labelOn,
  labelOff,
  titleOn,
  titleOff,
  tone,
  dimWhenOff,
  onClick,
}: {
  active: boolean;
  pending?: boolean;
  disabled?: boolean;
  labelOn: string;
  labelOff: string;
  titleOn: string;
  titleOff: string;
  tone: "green" | "emerald" | "brand";
  dimWhenOff?: boolean;
  onClick: () => void;
}) {
  const onTones = {
    green: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
    emerald: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
    brand: "bg-brand-100 text-brand-700 hover:bg-brand-100/80",
  };
  const offTone = dimWhenOff
    ? "bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
    : "bg-slate-100 text-slate-600 hover:bg-slate-200";

  return (
    <button
      type="button"
      disabled={disabled || pending}
      title={active ? titleOn : titleOff}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium transition",
        disabled && "cursor-not-allowed opacity-50",
        active ? onTones[tone] : offTone,
      )}
    >
      {pending ? "…" : active ? labelOn : labelOff}
    </button>
  );
}
