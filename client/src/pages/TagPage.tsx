import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useProductsByTag } from "@/hooks/useProducts";
import { CatalogProductCard, ProductGridSkeleton } from "@/components/product/CatalogProductCard";
import { CatalogSearchBar } from "@/components/product/CatalogSearchBar";
import { CatalogFilters } from "@/components/product/CatalogFilters";
import { ProductTagBadge } from "@/components/product/ProductTagBadge";
import { Reveal } from "@/components/motion/Reveal";
import { PaginationControls } from "@/components/ClientPagination";
import { catalogFiltersFromSearchParams } from "@/lib/catalogFilters";

const PAGE_SIZE = 12;

export function TagPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const filters = useMemo(() => catalogFiltersFromSearchParams(searchParams), [searchParams]);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [slug, filters.flavor, filters.minPrice, filters.maxPrice, filters.sort]);

  const { data, isLoading, isError } = useProductsByTag(slug, page, PAGE_SIZE, filters);

  const products = data?.items ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Reveal>
        <div className="mx-auto mb-6 max-w-xl rounded-2xl border border-white/50 bg-white/40 px-4 py-5 text-center shadow-sm backdrop-blur-md">
          {data && (
            <div className="mb-3 flex justify-center">
              <ProductTagBadge tag={{ id: data.tag.slug, ...data.tag }} size="md" />
            </div>
          )}
          <h1 className="font-display text-2xl text-ink-900 sm:text-3xl">
            {data?.tag.name ?? "Collection"}
          </h1>
          {data && (
            <p className="mt-1 text-sm text-ink-500">
              {data.total} {data.total === 1 ? "treat" : "treats"} in this collection
            </p>
          )}
        </div>
      </Reveal>

      <div className="mb-6 flex justify-center">
        <CatalogSearchBar className="w-full max-w-md" />
      </div>

      <CatalogFilters className="mb-8" onChange={() => setPage(1)} />

      {isLoading && <ProductGridSkeleton />}

      {isError && (
        <div className="rounded-card border border-cream-200 bg-white p-10 text-center text-sm text-ink-500">
          We couldn&rsquo;t find that collection.{" "}
          <Link to="/" className="text-brand-500 hover:underline">
            Back to home
          </Link>
        </div>
      )}

      {!isLoading && !isError && products.length === 0 && (
        <div className="rounded-card border border-cream-200 bg-white p-10 text-center text-sm text-ink-500">
          Nothing matches these filters — try clearing them or check back soon.
        </div>
      )}

      {products.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-6 xl:grid-cols-3">
            {products.map((product, index) => (
              <Reveal key={product.id} className="h-full" delay={(index % 6) * 60}>
                <CatalogProductCard
                  product={product}
                  className="h-full"
                  omitTagSlug={data?.tag.slug}
                />
              </Reveal>
            ))}
          </div>

          {data && (
            <PaginationControls
              page={data.page}
              pageCount={data.totalPages}
              onPageChange={setPage}
              className="mt-8"
            />
          )}
        </>
      )}
    </div>
  );
}
