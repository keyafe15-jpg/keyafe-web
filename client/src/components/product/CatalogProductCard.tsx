import { Link } from "react-router-dom";
import { categoryNames, type ProductCard } from "@/hooks/useProducts";
import { ProductCardTags } from "@/components/product/ProductTagBadge";
import { cn } from "@/lib/cn";

interface CatalogProductCardProps {
  product: ProductCard;
  className?: string;
  /**
   * Hide this tag's badge. Used by tag-led sections, where repeating the
   * section's own tag on every card is just noise.
   */
  omitTagSlug?: string;
}

export function CatalogProductCard({ product, className, omitTagSlug }: CatalogProductCardProps) {
  const priceValue = `₹${Number(product.startingPrice).toFixed(0)}`;
  const showsRange = product.template !== "CAKE";
  const tags = omitTagSlug ? product.tags.filter((t) => t.slug !== omitTagSlug) : product.tags;
  const soldOut = !product.isAvailable;

  return (
    <Link
      to={`/product/${product.slug}`}
      aria-disabled={soldOut || undefined}
      className={cn(
        "group flex flex-col overflow-hidden rounded-card border border-cream-200 bg-white shadow-sm transition",
        soldOut
          ? "opacity-75"
          : "hover:-translate-y-1 hover:shadow-md",
        className,
      )}
    >
      <div className="relative aspect-square overflow-hidden bg-cream-100">
        {tags.length > 0 && (
          <ProductCardTags
            tags={tags}
            className="absolute top-2 left-2 z-10 flex flex-wrap gap-1"
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
      <div className="flex flex-1 flex-col p-2.5 sm:p-4">
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
        <div className="mt-auto flex items-center justify-between gap-1 pt-2 sm:pt-3">
          <span
            className={cn(
              "text-sm font-semibold sm:text-lg",
              soldOut ? "text-ink-500" : "text-ink-900",
            )}
          >
            {showsRange && (
              <span className="mr-1 hidden text-xs font-normal text-ink-500 sm:inline">
                starts from
              </span>
            )}
            {priceValue}
          </span>
          {!soldOut && product.supportsSameDayDelivery ? (
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
