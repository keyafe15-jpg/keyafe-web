import { Link } from "react-router-dom";
import { PageMotifs } from "@/components/decor/PageMotifs";
import { HOME_COPY } from "@/content/home";
import { useCategories } from "@/hooks/useCategories";

export function HomePage() {
  const { data: categories = [], isLoading } = useCategories();

  return (
    <div className="relative isolate">
      <PageMotifs />

      <section className="mx-auto max-w-6xl px-4 pt-16 pb-12 text-center">
        <p className="mb-3 text-sm uppercase tracking-widest text-brand-500">
          {HOME_COPY.hero.eyebrow}
        </p>
        <h1 className="mb-4 text-5xl font-bold text-ink-900 md:text-6xl">
          {HOME_COPY.hero.heading[0]}
          <br />
          {HOME_COPY.hero.heading[1]}
        </h1>
        <p className="mx-auto max-w-xl text-ink-700">{HOME_COPY.hero.sub}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to={HOME_COPY.hero.primaryCta.to}
            className="rounded-full bg-brand-500 px-6 py-3 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            {HOME_COPY.hero.primaryCta.label}
          </Link>
          <Link
            to={HOME_COPY.hero.secondaryCta.to}
            className="rounded-full border border-ink-700 px-6 py-3 text-sm font-medium text-ink-700 transition hover:bg-cream-100"
          >
            {HOME_COPY.hero.secondaryCta.label}
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="mb-8 text-3xl">
          {HOME_COPY.sectionHeadings.shopByCategory}
        </h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading &&
            Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-card border border-cream-200 bg-white p-6 shadow-sm"
              >
                <div className="mb-4 aspect-[4/3] rounded-xl bg-cream-100" />
                <div className="mb-2 h-5 w-2/3 rounded bg-cream-100" />
                <div className="h-4 w-full rounded bg-cream-100" />
              </div>
            ))}
          {!isLoading &&
            categories.map((c) => (
              <Link
                key={c.id}
                to={`/category/${c.slug}`}
                className="group block rounded-card border border-cream-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                {c.imageUrl ? (
                  <img
                    src={c.imageUrl}
                    alt={c.name}
                    className="mb-4 aspect-[4/3] w-full rounded-xl object-cover"
                  />
                ) : (
                  <div className="mb-4 aspect-[4/3] rounded-xl bg-cream-100" />
                )}
                <h3 className="mb-1 text-xl group-hover:text-brand-500">
                  {c.name}
                </h3>
                {c.description && (
                  <p className="text-sm text-ink-500">{c.description}</p>
                )}
              </Link>
            ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex flex-col items-center gap-6 rounded-card border border-cream-200 bg-white p-8 shadow-sm md:flex-row md:justify-between md:p-10">
          <div className="max-w-xl md:pr-6">
            <p className="mb-2 text-sm uppercase tracking-widest text-brand-500">
              {HOME_COPY.quoteBanner.eyebrow}
            </p>
            <h2 className="mb-2 font-display text-2xl text-ink-900 md:text-3xl">
              {HOME_COPY.quoteBanner.title}
            </h2>
            <p className="text-ink-500">{HOME_COPY.quoteBanner.body}</p>
          </div>
          <Link
            to={HOME_COPY.quoteBanner.cta.to}
            className="shrink-0 rounded-full bg-brand-500 px-6 py-3 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            {HOME_COPY.quoteBanner.cta.label}
          </Link>
        </div>
      </section>
    </div>
  );
}
