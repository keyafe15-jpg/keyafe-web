import { useState } from "react";
import { Link, NavLink, useSearchParams } from "react-router-dom";
import { cn } from "@/lib/cn";
import { useSameDayStatus } from "@/hooks/useSameDayStatus";
import { useSameDayCategories } from "@/hooks/useSameDayCategories";
import { SAMEDAY_COPY, SAMEDAY_PLACEHOLDER_PRODUCTS } from "@/content/sameday";

export function SameDayPage() {
  const { data: status, isLoading: statusLoading } = useSameDayStatus();
  const { data: categories = [], isLoading: catsLoading } =
    useSameDayCategories();
  const isOpen = status?.isOpen ?? false;
  const statusMessage = status?.message ?? "";

  const [params, setParams] = useSearchParams();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const activeSlug = params.get("cat") ?? categories[0]?.slug;
  const activeCategory =
    categories.find((c) => c.slug === activeSlug) ?? categories[0];

  const setCategory = (slug: string) => {
    setParams({ cat: slug });
    setMobileNavOpen(false);
  };

  return (
    <section className="mx-auto max-w-6xl px-4 pt-8 pb-16">
      {/* Header + hours banner */}
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-2 flex items-center gap-2 text-sm uppercase tracking-widest text-brand-500">
            <BoltIcon /> {SAMEDAY_COPY.eyebrow}
          </p>
          <h1 className="font-display text-3xl text-ink-900 md:text-4xl">
            {SAMEDAY_COPY.title}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-ink-500">
            {SAMEDAY_COPY.sub}
          </p>
        </div>
        {!statusLoading && (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-2 self-start rounded-full border px-3 py-1.5 text-xs font-medium",
              isOpen
                ? "border-brand-300 bg-brand-100 text-brand-700"
                : "border-cream-200 bg-cream-100 text-ink-500",
            )}
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                isOpen ? "bg-brand-500" : "bg-ink-500",
              )}
            />
            {statusMessage}
          </span>
        )}
      </div>

      {/* Closed full-page notice */}
      {!statusLoading && !isOpen && (
        <div className="mb-6 flex flex-col items-center gap-3 rounded-card border border-cream-200 bg-cream-50 p-8 text-center">
          <div className="rounded-full bg-cream-100 p-3 text-ink-500">
            <ClockIcon />
          </div>
          <h2 className="font-display text-xl text-ink-900">
            Same-day store is closed
          </h2>
          <p className="max-w-md text-sm text-ink-500">{statusMessage}</p>
          <p className="text-xs text-ink-500">
            You can still browse our full catalogue and pre-order celebration
            cakes for later.
          </p>
        </div>
      )}

      {/* Mobile category picker */}
      <div className="mb-4 md:hidden">
        <button
          type="button"
          onClick={() => setMobileNavOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm"
        >
          <span>
            <span className="text-ink-500">
              {SAMEDAY_COPY.sidebarMobileLabel}:
            </span>{" "}
            <span className="font-medium text-ink-900">
              {activeCategory?.name ?? "…"}
            </span>
          </span>
          <ChevronIcon open={mobileNavOpen} />
        </button>
        {mobileNavOpen && (
          <ul className="mt-2 space-y-1 rounded-lg border border-cream-200 bg-white p-2">
            {categories.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setCategory(c.slug)}
                  className={cn(
                    "block w-full rounded-md px-3 py-2 text-left text-sm transition",
                    c.slug === activeCategory?.slug
                      ? "bg-brand-100 text-brand-700"
                      : "text-ink-700 hover:bg-cream-100",
                  )}
                >
                  {c.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        {/* Sidebar */}
        <aside className="hidden md:block">
          <div className="sticky top-24">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-500">
              {SAMEDAY_COPY.sidebarHeading}
            </p>
            <nav className="space-y-1">
              {catsLoading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-9 animate-pulse rounded-lg bg-cream-100"
                  />
                ))}
              {!catsLoading &&
                categories.map((c) => (
                  <NavLink
                    key={c.id}
                    to={`/same-day?cat=${c.slug}`}
                    onClick={(e) => {
                      e.preventDefault();
                      setCategory(c.slug);
                    }}
                    className={cn(
                      "block rounded-lg px-3 py-2 text-sm transition",
                      c.slug === activeCategory?.slug
                        ? "bg-brand-100 font-medium text-brand-700"
                        : "text-ink-700 hover:bg-cream-100",
                    )}
                  >
                    {c.name}
                  </NavLink>
                ))}
            </nav>

            <p className="mt-6 rounded-lg border border-cream-200 bg-cream-50 p-3 text-xs text-ink-500">
              {SAMEDAY_COPY.deliveryFeeNote}
            </p>
          </div>
        </aside>

        {/* Products grid */}
        <div className={cn(!isOpen && "opacity-60")}>
          <h2 className="mb-1 text-xl text-ink-900">
            {activeCategory?.name ?? "\u00a0"}
          </h2>
          {activeCategory?.description && (
            <p className="mb-4 text-sm text-ink-500">
              {activeCategory.description}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeCategory &&
              SAMEDAY_PLACEHOLDER_PRODUCTS.map((n) => {
                const productSlug = `${activeCategory.slug}-item-${n}`;
                return (
                  <article
                    key={n}
                    className="group rounded-card border border-cream-200 bg-white p-3 shadow-sm transition hover:shadow-md"
                  >
                    <Link to={`/product/${productSlug}`} className="block">
                      <div className="mb-3 aspect-square rounded-lg bg-cream-100" />
                      <h3 className="text-sm font-medium text-ink-900 group-hover:text-brand-500">
                        Placeholder {activeCategory.name} {n}
                      </h3>
                      <p className="mt-1 text-xs text-ink-500">₹— · same-day</p>
                    </Link>
                    <button
                      type="button"
                      disabled={!isOpen}
                      className="mt-3 w-full rounded-full bg-brand-500 py-1.5 text-xs font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isOpen ? "Add to cart" : "Closed"}
                    </button>
                  </article>
                );
              })}
          </div>
        </div>
      </div>
    </section>
  );
}

function BoltIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      width={28}
      height={28}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx={12} cy={12} r={10} />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("text-ink-500 transition-transform", open && "rotate-180")}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
