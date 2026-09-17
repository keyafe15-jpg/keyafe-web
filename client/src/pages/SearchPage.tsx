import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Search, X } from "lucide-react";
import { useProductSearch } from "@/hooks/useProducts";
import { CatalogProductCard, ProductGridSkeleton } from "@/components/product/CatalogProductCard";
import { Reveal } from "@/components/motion/Reveal";
import { PaginationControls } from "@/components/ClientPagination";
import { Seo } from "@/components/seo/Seo";

const PAGE_SIZE = 12;
const MIN_QUERY = 2;

export function SearchPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const urlQ = params.get("q") ?? "";
  const [input, setInput] = useState(urlQ);
  const [page, setPage] = useState(1);

  // When the URL changes from outside (header / home / back), mirror it into
  // the input. Adjusted during render so we don't need a syncing effect.
  const [prevUrlQ, setPrevUrlQ] = useState(urlQ);
  if (urlQ !== prevUrlQ) {
    setPrevUrlQ(urlQ);
    setInput(urlQ);
    setPage(1);
  }

  function leaveSearch() {
    if (location.key !== "default") navigate(-1);
    else navigate("/");
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = input.trim();

      // Cleared the field after a query — return to the previous page.
      if (!next) {
        if (urlQ.trim()) {
          if (location.key !== "default") navigate(-1);
          else navigate("/");
        }
        return;
      }

      if (next === urlQ.trim()) return;
      setPage(1);
      setParams(
        (prev) => {
          const nextParams = new URLSearchParams(prev);
          nextParams.set("q", next);
          return nextParams;
        },
        { replace: true },
      );
    }, 300);
    return () => window.clearTimeout(timer);
  }, [input, setParams, urlQ, location.key, navigate]);

  // URL is the source of truth for the fetch (updated after the debounce above).
  const debouncedQ = urlQ.trim();
  const searching = debouncedQ.length >= MIN_QUERY;
  const { data, isLoading, isFetching, isError } = useProductSearch(debouncedQ, page, PAGE_SIZE);

  const products = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Seo
        title={searching ? `Search “${debouncedQ}”` : "Search treats"}
        description="Find cakes, cookies, pizzas and more in the Keyafe catalogue."
        noIndex
      />

      <Reveal>
        <div className="mx-auto mb-8 max-w-xl">
          <p className="mb-2 text-center text-xs font-semibold tracking-[0.28em] text-brand-500 uppercase">
            Search
          </p>
          <h1 className="mb-4 text-center font-display text-2xl text-ink-900 sm:text-3xl">
            Find a treat
          </h1>

          <label className="relative block">
            <span className="sr-only">Search products</span>
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-ink-500"
              aria-hidden="true"
            />
            <input
              type="search"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Search cakes, cookies, pizzas…"
              autoFocus
              className="w-full rounded-full border border-cream-200 bg-white py-3 pr-10 pl-10 text-sm text-ink-900 shadow-sm outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20"
            />
            {input && (
              <button
                type="button"
                onClick={leaveSearch}
                className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-1 text-ink-500 hover:bg-cream-100 hover:text-ink-700"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </label>

          <p className="mt-3 text-center text-sm text-ink-500">
            {!searching && "Type at least 2 characters to search."}
            {searching && isLoading && "Searching…"}
            {searching && !isLoading && !isError && (
              <>
                {total} match{total === 1 ? "" : "es"}
                {isFetching ? "…" : ""} for “{debouncedQ}”
              </>
            )}
          </p>
        </div>
      </Reveal>

      {searching && isLoading && <ProductGridSkeleton />}

      {searching && isError && (
        <div className="rounded-card border border-cream-200 bg-white p-10 text-center text-sm text-ink-500">
          Something went wrong searching. Please try again.
        </div>
      )}

      {searching && !isLoading && !isError && products.length === 0 && (
        <div className="rounded-card border border-cream-200 bg-white p-10 text-center text-sm text-ink-500">
          <p className="mb-4">No treats matched “{debouncedQ}”.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/store/dessert" className="text-brand-500 hover:underline">
              Dessert store
            </Link>
            <Link to="/store/savory" className="text-brand-500 hover:underline">
              Savoury store
            </Link>
            <Link to="/get-quote" className="text-brand-500 hover:underline">
              Get a quote
            </Link>
          </div>
        </div>
      )}

      {products.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-6 xl:grid-cols-3">
            {products.map((product, index) => (
              <Reveal key={product.id} className="h-full" delay={(index % 6) * 60}>
                <CatalogProductCard product={product} className="h-full" />
              </Reveal>
            ))}
          </div>

          {data && data.totalPages > 1 && (
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
