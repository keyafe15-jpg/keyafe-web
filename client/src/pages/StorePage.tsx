import { Link, useParams } from "react-router-dom";
import { useMemo } from "react";
import { useCategories, useDepartments, type CategoryNode } from "@/hooks/useCategories";
import { STORE_COPY } from "@/content/store";
import { Reveal } from "@/components/motion/Reveal";

export function StorePage() {
  const { slug = "" } = useParams<{ slug: string }>();

  const { data: stores = [], isLoading: storesLoading } = useDepartments();
  const { data: tree = [], isLoading: catsLoading } = useCategories();

  const store = stores.find((s) => s.slug === slug) ?? null;
  const groups = useMemo(() => tree.filter((c) => c.department?.slug === slug), [tree, slug]);

  const copy =
    slug in STORE_COPY.bySlug ? STORE_COPY.bySlug[slug as keyof typeof STORE_COPY.bySlug] : null;
  const title = copy?.title ?? (store ? `The ${store.name} Store` : "Store");
  const sub = copy?.sub ?? STORE_COPY.fallbackSub;
  const eyebrow = copy?.eyebrow ?? store?.name ?? "Shop";

  if (!storesLoading && !store) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-12">
        <h1 className="mb-2 text-3xl capitalize">{slug.replace(/-/g, " ")}</h1>
        <p className="text-ink-500">
          {STORE_COPY.notFoundBody} Try{" "}
          <Link to="/" className="text-brand-500 hover:underline">
            {STORE_COPY.homeLink}
          </Link>
          .
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-10">
      <nav className="mb-4 text-xs text-ink-500">
        <Link to="/" className="hover:text-brand-500">
          Home
        </Link>
        <span className="mx-2">›</span>
        <span className="text-ink-700">{title}</span>
      </nav>

      <header className="mb-8">
        <p className="mb-2 text-xs font-semibold tracking-[0.28em] text-brand-500 uppercase">
          {eyebrow}
        </p>
        <h1 className="text-3xl text-ink-900">{title}</h1>
        <p className="mt-2 max-w-2xl text-ink-500">{sub}</p>
      </header>

      {catsLoading ? (
        <div className="mb-12 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[4/3] animate-pulse rounded-[1.75rem] border border-cream-200 bg-cream-100"
            />
          ))}
        </div>
      ) : groups.length > 0 ? (
        <div className="mb-12">
          <p className="mb-3 text-xs font-semibold tracking-[0.2em] text-ink-500 uppercase">
            {STORE_COPY.shopByCategory}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-6">
            {groups.map((group, index) => (
              <Reveal key={group.id} delay={(index % 3) * 80}>
                <CategoryDoor category={group} />
              </Reveal>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function CategoryDoor({ category }: { category: CategoryNode }) {
  const childHint = category.children
    .slice(0, 3)
    .map((c) => c.name)
    .join(" · ");
  const extra = category.children.length - 3;

  return (
    <Link
      to={`/category/${category.slug}`}
      className="group relative block aspect-[4/3] overflow-hidden rounded-[1.75rem] border border-cream-200 bg-cream-100 shadow-sm transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_24px_40px_rgba(26,33,42,0.14)]"
    >
      {category.imageUrl ? (
        <img
          src={category.imageUrl}
          alt=""
          className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
        />
      ) : (
        <div className="from-brand-50 flex h-full w-full items-center justify-center bg-gradient-to-br to-cream-100 text-4xl">
          {category.name.slice(0, 1)}
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-ink-900/85 via-ink-900/10 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-3 sm:p-5">
        <h2 className="text-base font-semibold text-white drop-shadow-sm sm:text-xl">
          {category.name}
        </h2>
        {childHint ? (
          <p className="mt-1 line-clamp-1 text-[11px] text-white/80 sm:text-sm">
            {childHint}
            {extra > 0 ? ` +${extra}` : ""}
          </p>
        ) : category.description ? (
          <p className="mt-1 line-clamp-1 text-[11px] text-white/80 sm:text-sm">
            {category.description}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
