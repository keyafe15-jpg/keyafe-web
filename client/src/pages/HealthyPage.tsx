import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useHealthyTreatProducts, type ProductCard } from "@/hooks/useProducts";
import { Reveal } from "@/components/motion/Reveal";
import { HEALTHY_COPY } from "@/content/healthy";
import { cn } from "@/lib/cn";
import {
  ClientPagination,
  PaginationControls,
} from "@/components/ClientPagination";

const PAGE_SIZE = 12;

export function HealthyPage() {
  const { data: products = [], isLoading } = useHealthyTreatProducts();
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  const categories = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const p of products) {
      if (!map.has(p.category.id)) {
        map.set(p.category.id, { id: p.category.id, name: p.category.name });
      }
    }
    return [...map.values()];
  }, [products]);

  const visibleProducts = activeCategoryId
    ? products.filter((p) => p.category.id === activeCategoryId)
    : products;

  const selectCategory = (id: string | null) => {
    setActiveCategoryId(id);
  };

  return (
    <section className="mx-auto max-w-6xl px-4 pt-8 pb-16">
      <div className="mb-8">
        <p className="mb-2 flex items-center gap-2 text-sm uppercase tracking-widest text-brand-500">
          <LeafIcon /> {HEALTHY_COPY.eyebrow}
        </p>
        <h1 className="font-display text-3xl text-ink-900 md:text-4xl">
          {HEALTHY_COPY.title}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-ink-500">{HEALTHY_COPY.sub}</p>
      </div>

      {!isLoading && categories.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
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
        <ClientPagination
          items={visibleProducts}
          pageSize={PAGE_SIZE}
          resetKey={activeCategoryId ?? "all"}
        >
          {({ items, page, pageCount, setPage }) => (
            <>
              <div className="grid grid-cols-2 gap-3 sm:gap-6 xl:grid-cols-3">
                {items.map((p, index) => (
                  <Reveal key={p.id} delay={(index % 6) * 60}>
                    <HealthyProductCard product={p} />
                  </Reveal>
                ))}
              </div>

              <PaginationControls
                page={page}
                pageCount={pageCount}
                onPageChange={setPage}
              />
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
        "rounded-full border px-3.5 py-1.5 text-sm font-medium transition",
        active
          ? "border-brand-500 bg-brand-500 text-white shadow-[0_8px_16px_rgba(227,28,121,0.2)]"
          : "border-cream-200 bg-white text-ink-700 hover:border-brand-200 hover:text-brand-600",
      )}
    >
      {label}
    </button>
  );
}

function HealthyProductCard({ product }: { product: ProductCard }) {
  const priceValue = `₹${Number(product.startingPrice).toFixed(0)}`;
  const showsRange = product.template !== "CAKE";
  return (
    <Link
      to={`/product/${product.slug}`}
      className="group block overflow-hidden rounded-card border border-cream-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md"
    >
      <div className="aspect-square overflow-hidden bg-cream-100">
        {product.images[0] ? (
          <img
            src={product.images[0]}
            alt={product.name}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-ink-400">
            No image
          </div>
        )}
      </div>
      <div className="p-2.5 sm:p-4">
        <p className="text-[10px] uppercase tracking-wide text-ink-400 sm:text-xs">
          {product.category.name}
        </p>
        <h3 className="mt-1 line-clamp-1 text-sm text-ink-900 group-hover:text-brand-500 sm:text-lg">
          {product.name}
        </h3>
        {product.shortDescription && (
          <p className="mt-1 hidden line-clamp-2 text-sm text-ink-500 sm:block">
            {product.shortDescription}
          </p>
        )}
        <div className="mt-2 flex items-center justify-between gap-1 sm:mt-3">
          <span className="text-sm font-semibold text-ink-900 sm:text-lg">
            {showsRange && (
              <span className="mr-1 hidden text-xs font-normal text-ink-500 sm:inline">
                starts from
              </span>
            )}
            {priceValue}
          </span>
          {!product.isAvailable ? (
            <span className="rounded-md bg-cream-200 px-1.5 py-0.5 text-[10px] text-ink-500 sm:px-2 sm:text-xs">
              Sold out
            </span>
          ) : (
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
        <div
          key={i}
          className="overflow-hidden rounded-card border border-cream-200 bg-white"
        >
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
