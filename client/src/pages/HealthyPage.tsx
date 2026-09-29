import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  useHealthyTreatProducts,
  type ProductCard,
  categoryNames,
  productInCategoryIds,
} from "@/hooks/useProducts";
import { Reveal } from "@/components/motion/Reveal";
import { ProductCardTags } from "@/components/product/ProductTagBadge";
import { VegMark } from "@/components/product/VegMark";
import { HEALTHY_COPY } from "@/content/healthy";
import { cn } from "@/lib/cn";
import { ClientPagination, PaginationControls } from "@/components/ClientPagination";
import { CatalogSearchBar } from "@/components/product/CatalogSearchBar";
import { CatalogFilters } from "@/components/product/CatalogFilters";
import { Price } from "@keyafe/shared";
import { applyCatalogFilters, catalogFiltersFromSearchParams } from "@/lib/catalogFilters";

const PAGE_SIZE = 12;

export function HealthyPage() {
  const { data: products = [], isLoading } = useHealthyTreatProducts();
  const [searchParams] = useSearchParams();
  const catalogFilters = useMemo(
    () => catalogFiltersFromSearchParams(searchParams),
    [searchParams],
  );
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  const categories = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const p of products) {
      for (const c of p.categories) {
        if (!map.has(c.id)) {
          map.set(c.id, { id: c.id, name: c.name });
        }
      }
    }
    return [...map.values()];
  }, [products]);

  const visibleProducts = useMemo(() => {
    const byCategory = activeCategoryId
      ? products.filter((p) => productInCategoryIds(p, new Set([activeCategoryId])))
      : products;
    return applyCatalogFilters(byCategory, catalogFilters);
  }, [products, activeCategoryId, catalogFilters]);

  const selectCategory = (id: string | null) => {
    setActiveCategoryId(id);
  };

  const filterResetKey = `${activeCategoryId ?? "all"}|${catalogFilters.flavor}|${catalogFilters.minPrice}|${catalogFilters.maxPrice}|${catalogFilters.sort}|${catalogFilters.noCream}|${catalogFilters.fixedDesign}|${catalogFilters.diet}|${catalogFilters.heat}`;

  return (
    <section className="mx-auto max-w-6xl px-4 pt-5 pb-16 sm:pt-8">
      <div className="mb-3 sm:mb-6">
        <div className="min-w-0">
          <p className="mb-1 flex items-center gap-2 text-xs tracking-widest text-brand-500 uppercase sm:mb-2 sm:text-sm">
            <LeafIcon /> {HEALTHY_COPY.eyebrow}
          </p>
          <h1 className="font-display text-2xl text-ink-900 sm:text-3xl md:text-4xl">
            {HEALTHY_COPY.title}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-ink-500 sm:mt-2">{HEALTHY_COPY.sub}</p>
        </div>
      </div>

      <CatalogFilters className="mb-3 max-w-2xl sm:mb-6" leading={<CatalogSearchBar />} />

      {!isLoading && categories.length > 0 && (
        <div className="-mx-4 mb-3 flex [scrollbar-width:none] gap-2 overflow-x-auto px-4 py-1 [-ms-overflow-style:none] sm:mx-0 sm:mb-6 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
          <PillButton
            label={HEALTHY_COPY.allFilterLabel}
            active={activeCategoryId === null}
            onClick={() => selectCategory(null)}
          />
          {categories.map((c) => (
            <PillButton
              key={c.id}
              label={c.name}
              active={activeCategoryId === c.id}
              onClick={() => selectCategory(c.id)}
            />
          ))}
        </div>
      )}

      {isLoading && <ProductGridSkeleton />}

      {!isLoading && visibleProducts.length === 0 && (
        <div className="rounded-card border border-cream-200 bg-cream-50 p-8 text-center text-sm text-ink-500">
          {HEALTHY_COPY.emptyState}
        </div>
      )}

      {!isLoading && visibleProducts.length > 0 && (
        <ClientPagination items={visibleProducts} pageSize={PAGE_SIZE} resetKey={filterResetKey}>
          {({ items, page, pageCount, setPage }) => (
            <>
              <div className="grid grid-cols-2 gap-3 sm:gap-6 xl:grid-cols-3">
                {items.map((p, index) => (
                  <Reveal key={p.id} delay={(index % 6) * 60}>
                    <HealthyProductCard product={p} />
                  </Reveal>
                ))}
              </div>

              <PaginationControls page={page} pageCount={pageCount} onPageChange={setPage} />
            </>
          )}
        </ClientPagination>
      )}
    </section>
  );
}

function PillButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1 text-sm font-medium whitespace-nowrap transition sm:px-3.5 sm:py-1.5",
        active
          ? "border-brand-500 bg-brand-500 text-white shadow-[0_3px_8px_rgba(227,28,121,0.25)]"
          : "hover:border-brand-200 hover:text-brand-600 border-cream-200 bg-white text-ink-700",
      )}
    >
      {label}
    </button>
  );
}

function HealthyProductCard({ product }: { product: ProductCard }) {
  const showsRange = product.template !== "CAKE";
  const soldOut = !product.isAvailable;
  return (
    <Link
      to={`/product/${product.slug}`}
      className={cn(
        "group block overflow-hidden rounded-card border border-cream-200 bg-white shadow-sm transition",
        soldOut ? "opacity-75" : "hover:-translate-y-1 hover:shadow-md",
      )}
    >
      <div className="relative aspect-square overflow-hidden bg-cream-100">
        {product.isEggless && <VegMark className="absolute top-2 left-2 z-10" />}
        {product.tags.length > 0 && (
          <ProductCardTags
            tags={product.tags}
            className="absolute top-2 right-2 z-10 flex max-w-[70%] flex-wrap justify-end gap-1"
          />
        )}
        {product.images[0] ? (
          <img
            src={product.images[0]}
            alt={product.name}
            className={cn(
              "h-full w-full object-cover transition duration-300",
              soldOut ? "grayscale" : "group-hover:scale-105",
            )}
            loading="lazy"
          />
        ) : (
          <div className="text-ink-400 flex h-full w-full items-center justify-center text-xs">
            No image
          </div>
        )}
        {soldOut && (
          <span className="absolute inset-x-0 bottom-0 bg-ink-900/70 py-1.5 text-center text-[10px] font-semibold tracking-wide text-white uppercase sm:text-xs">
            Out of stock
          </span>
        )}
      </div>
      <div className="p-2.5 sm:p-4">
        <p className="text-ink-400 text-[10px] tracking-wide uppercase sm:text-xs">
          {categoryNames(product)}
        </p>
        <h3
          className={cn(
            "mt-1 line-clamp-1 text-sm sm:text-lg",
            soldOut ? "text-ink-500" : "text-ink-900 group-hover:text-brand-500",
          )}
        >
          {product.name}
        </h3>
        {product.shortDescription && (
          <p className="mt-1 line-clamp-2 hidden text-sm text-ink-500 sm:block">
            {product.shortDescription}
          </p>
        )}
        <div className="mt-2 flex items-center justify-between gap-1 sm:mt-3">
          <Price
            amount={product.startingPrice}
            original={product.originalStartingPrice}
            prefix={showsRange ? <span className="hidden sm:inline">starts from</span> : undefined}
            showBadge
            className={cn("text-sm sm:text-lg", soldOut ? "text-ink-500" : "text-ink-900")}
          />
          {!soldOut && (
            <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-700 sm:px-2 sm:text-xs">
              Healthy
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-6 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-card border border-cream-200 bg-white">
          <div className="aspect-square animate-pulse bg-cream-100" />
          <div className="space-y-2 p-4">
            <div className="h-3 w-1/3 animate-pulse rounded bg-cream-100" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-cream-100" />
            <div className="h-3 w-full animate-pulse rounded bg-cream-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

function LeafIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19.2 2.96c1.4-.98 2.3-.19 2.05 1.28C20.28 12 16 22 11 22" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6" />
    </svg>
  );
}
