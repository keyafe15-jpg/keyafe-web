import { Link } from "react-router-dom";
import { categoryNames, type ProductCard } from "@/hooks/useProducts";
import { ProductCardTags } from "@/components/product/ProductTagBadge";

export function CatalogProductCard({ product }: { product: ProductCard }) {
  const priceValue = `₹${Number(product.startingPrice).toFixed(0)}`;
  const showsRange = product.template !== "CAKE";
  return (
    <Link
      to={`/product/${product.slug}`}
      className="group block overflow-hidden rounded-card border border-cream-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md"
    >
      <div className="relative aspect-square overflow-hidden bg-cream-100">
        {product.tags.length > 0 && (
          <ProductCardTags
            tags={product.tags}
            className="absolute left-2 top-2 z-10 flex flex-wrap gap-1"
          />
        )}
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
          {categoryNames(product)}
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
          ) : product.supportsSameDayDelivery ? (
            <span className="rounded-md bg-brand-100 px-1.5 py-0.5 text-[10px] text-brand-700 sm:px-2 sm:text-xs">
              Same-day
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

export function ProductGridSkeleton() {
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
