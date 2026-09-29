import { Link, useParams, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCategories, type CategoryNode } from "@/hooks/useCategories";
import { useProductsByCategory } from "@/hooks/useProducts";
import { CATEGORY_PLACEHOLDER_COPY } from "@/content/misc";
import { Reveal } from "@/components/motion/Reveal";
import { cn } from "@/lib/cn";
import { PaginationControls } from "@/components/ClientPagination";
import { CatalogProductCard, ProductGridSkeleton } from "@/components/product/CatalogProductCard";
import { CatalogSearchBar } from "@/components/product/CatalogSearchBar";
import { CatalogFilters } from "@/components/product/CatalogFilters";
import { catalogFiltersFromSearchParams } from "@/lib/catalogFilters";

const PAGE_SIZE = 12;

export function CategoryPage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const filters = useMemo(() => catalogFiltersFromSearchParams(searchParams), [searchParams]);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [
    slug,
    filters.flavor,
    filters.minPrice,
    filters.maxPrice,
    filters.sort,
    filters.noCream,
    filters.fixedDesign,
    filters.diet,
    filters.heat,
  ]);

  const { data: tree = [], isLoading: catsLoading } = useCategories();
  const { data: response, isLoading: prodsLoading } = useProductsByCategory(
    slug,
    page,
    PAGE_SIZE,
    filters,
  );
  const products = response?.items ?? [];
  const totalPages = response?.totalPages ?? 1;

  const { current, parent } = useMemo(() => resolveCategory(tree, slug), [tree, slug]);

  const pillRowRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const row = pillRowRef.current;
    const active = row?.querySelector<HTMLElement>('[aria-current="page"]');
    if (row && active) {
      row.scrollLeft = active.offsetLeft - (row.clientWidth - active.offsetWidth) / 2;
    }
  }, [current?.id]);

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
    <section className="mx-auto max-w-7xl px-4 pt-5 pb-10 sm:py-10">
      <nav className="mb-2 text-xs text-ink-500 sm:mb-4">
        <Link to="/" className="hover:text-brand-500">
          Home
        </Link>
        {parent && (
          <>
            <span className="mx-2">›</span>
            <Link to={`/category/${parent.slug}`} className="hover:text-brand-500">
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

      <header className="mb-3 sm:mb-5">
        <h1 className="text-2xl text-ink-900 sm:text-3xl">{current?.name ?? "Loading…"}</h1>
        {current?.description && (
          <p className="mt-1 max-w-2xl text-sm text-ink-500 sm:mt-2 sm:text-base">
            {current.description}
          </p>
        )}
      </header>

      <CatalogFilters
        className="mb-3 max-w-2xl sm:mb-6"
        leading={<CatalogSearchBar />}
        departmentSlug={current?.department?.slug}
        onChange={() => setPage(1)}
      />

      <div className="grid gap-4 lg:grid-cols-[220px_1fr] lg:gap-8">
        {hasSubs && (
          <>
            {/* mobile/tablet: single scrollable pill row */}
            <nav
              ref={pillRowRef}
              aria-label={`${container?.name ?? "Category"} subcategories`}
              className="relative -mx-4 flex [scrollbar-width:none] gap-2 overflow-x-auto px-4 py-1 [-ms-overflow-style:none] lg:hidden [&::-webkit-scrollbar]:hidden"
            >
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
            </nav>

            {/* desktop: sidebar with sliding active indicator */}
            <aside className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
              <p className="mb-3 text-xs font-semibold tracking-wide text-ink-500 uppercase">
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
            <div className="border-cream-300 rounded-card border border-dashed bg-cream-50 p-10 text-center">
              <p className="text-ink-700">No products match these filters.</p>
              <p className="mt-1 text-sm text-ink-500">{CATEGORY_PLACEHOLDER_COPY.variantsSoon}</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:gap-6 xl:grid-cols-3">
                {products.map((p, index) => (
                  <Reveal key={p.id} delay={(index % 6) * 60}>
                    <CatalogProductCard product={p} />
                  </Reveal>
                ))}
              </div>

              <PaginationControls page={page} pageCount={totalPages} onPageChange={setPage} />
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function SidebarLink({ to, active, label }: { to: string; active: boolean; label: string }) {
  return (
    <li>
      <Link
        to={to}
        className={cn(
          "group relative block rounded-lg px-3 py-2 pl-4 text-sm transition",
          active ? "font-medium text-brand-700" : "text-ink-700 hover:bg-cream-100",
        )}
      >
        <span
          className={cn(
            "absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-full bg-brand-500 transition-all",
            active ? "opacity-100" : "opacity-0 group-hover:opacity-40",
          )}
          aria-hidden="true"
        />
        {label}
      </Link>
    </li>
  );
}

function PillLink({ to, active, label }: { to: string; active: boolean; label: string }) {
  return (
    <Link
      to={to}
      aria-current={active ? "page" : undefined}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1 text-sm font-medium whitespace-nowrap transition",
        active
          ? "border-brand-500 bg-brand-500 text-white shadow-[0_3px_8px_rgba(227,28,121,0.25)]"
          : "hover:border-brand-200 hover:text-brand-600 border-cream-200 bg-white text-ink-700",
      )}
    >
      {label}
    </Link>
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
