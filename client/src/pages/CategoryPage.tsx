import { Link, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useCategories, type CategoryNode } from "@/hooks/useCategories";
import { useProductsByCategory } from "@/hooks/useProducts";
import { CATEGORY_PLACEHOLDER_COPY } from "@/content/misc";
import { Reveal } from "@/components/motion/Reveal";
import { cn } from "@/lib/cn";
import { PaginationControls } from "@/components/ClientPagination";
import { ProductCardTags } from "@/components/product/ProductTagBadge";

const PAGE_SIZE = 12;

export function CategoryPage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [slug]);

  const { data: tree = [], isLoading: catsLoading } = useCategories();
  const { data: response, isLoading: prodsLoading } = useProductsByCategory(
    slug,
    page,
    PAGE_SIZE,
  );
  const products = response?.items ?? [];
  const totalPages = response?.totalPages ?? 1;

  const { current, parent } = useMemo(
    () => resolveCategory(tree, slug),
    [tree, slug],
  );

  if (!catsLoading && !current) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-12">
        <h1 className="mb-2 text-3xl capitalize">{slug.replace(/-/g, " ")}</h1>
        <p className="text-ink-500">
          We couldn&rsquo;t find this category. Try{" "}
          <Link to="/" className="text-brand-500 hover:underline">
            heading home
          </Link>
          .
        </p>
      </section>
    );
  }

  // Sidebar shows subcategories of the top-level ancestor.
  const container = parent ?? current;
  const subcategories = container?.children ?? [];
  const hasSubs = subcategories.length > 0;

  return (
    <section className="mx-auto max-w-7xl px-4 py-10">
      <nav className="mb-4 text-xs text-ink-500">
        <Link to="/" className="hover:text-brand-500">
          Home
        </Link>
        {parent && (
          <>
            <span className="mx-2">›</span>
            <Link
              to={`/category/${parent.slug}`}
              className="hover:text-brand-500"
            >
              {parent.name}
            </Link>
          </>
        )}
        {current && (
          <>
            <span className="mx-2">›</span>
            <span className="text-ink-700">{current.name}</span>
          </>
        )}
      </nav>

      <header className="mb-8">
        <h1 className="text-3xl text-ink-900">{current?.name ?? "Loading…"}</h1>
        {current?.description && (
          <p className="mt-2 max-w-2xl text-ink-500">{current.description}</p>
        )}
      </header>

      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        {hasSubs && (
          <>
            {/* mobile/tablet: wrapped pill filter bar */}
            <div className="lg:hidden">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-ink-500">
                {container?.name}
              </p>
              <div className="flex flex-wrap gap-2">
                <PillLink
                  to={`/category/${container!.slug}`}
                  active={current?.id === container!.id}
                  label="All"
                />
                {subcategories.map((sub) => (
                  <PillLink
                    key={sub.id}
                    to={`/category/${sub.slug}`}
                    active={current?.id === sub.id}
                    label={sub.name}
                  />
                ))}
              </div>
            </div>

            {/* desktop: sidebar with sliding active indicator */}
            <aside className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-500">
                {container?.name}
              </p>
              <ul className="space-y-1">
                <SidebarLink
                  to={`/category/${container!.slug}`}
                  active={current?.id === container!.id}
                  label="All"
                />
                {subcategories.map((sub) => (
                  <SidebarLink
                    key={sub.id}
                    to={`/category/${sub.slug}`}
                    active={current?.id === sub.id}
                    label={sub.name}
                  />
                ))}
              </ul>
            </aside>
          </>
        )}

        <div className={cn(!hasSubs && "lg:col-span-2")}>
          {prodsLoading ? (
            <ProductGridSkeleton />
          ) : products.length === 0 ? (
            <div className="rounded-card border border-dashed border-cream-300 bg-cream-50 p-10 text-center">
              <p className="text-ink-700">No products in this category yet.</p>
              <p className="mt-1 text-sm text-ink-500">
                {CATEGORY_PLACEHOLDER_COPY.variantsSoon}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:gap-6 xl:grid-cols-3">
                {products.map((p, index) => (
                  <Reveal key={p.id} delay={(index % 6) * 60}>
                    <ProductCard product={p} />
                  </Reveal>
                ))}
              </div>

              <PaginationControls
                page={page}
                pageCount={totalPages}
                onPageChange={setPage}
              />
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function SidebarLink({
  to,
  active,
  label,
}: {
  to: string;
  active: boolean;
  label: string;
}) {
  return (
    <li>
      <Link
        to={to}
        className={cn(
          "group relative block rounded-lg px-3 py-2 pl-4 text-sm transition",
          active
            ? "font-medium text-brand-700"
            : "text-ink-700 hover:bg-cream-100",
        )}
      >
        <span
          className={cn(
            "absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-brand-500 transition-all",
            active ? "opacity-100" : "opacity-0 group-hover:opacity-40",
          )}
          aria-hidden="true"
        />
        {label}
      </Link>
    </li>
  );
}

function PillLink({
  to,
  active,
  label,
}: {
  to: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-sm font-medium transition",
        active
          ? "border-brand-500 bg-brand-500 text-white shadow-[0_8px_16px_rgba(227,28,121,0.2)]"
          : "border-cream-200 bg-white text-ink-700 hover:border-brand-200 hover:text-brand-600",
      )}
    >
      {label}
    </Link>
  );
}

function ProductCard({
  product,
}: {
  product: import("@/hooks/useProducts").ProductCard;
}) {
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

function resolveCategory(
  tree: CategoryNode[],
  slug: string,
): { current: CategoryNode | null; parent: CategoryNode | null } {
  for (const top of tree) {
    if (top.slug === slug) return { current: top, parent: null };
    for (const child of top.children) {
      if (child.slug === slug) return { current: child, parent: top };
    }
  }
  return { current: null, parent: null };
}
