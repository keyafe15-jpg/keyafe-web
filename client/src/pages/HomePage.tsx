import { Link } from "react-router-dom";
import { HeroSlider } from "@/components/hero/HeroSlider";
import { PageMotifs } from "@/components/decor/PageMotifs";
import { HOME_COPY } from "@/content/home";
import { useCategories } from "@/hooks/useCategories";

const valuePills = [
  "Eggless cakes",
  "Custom occasions",
  "Fresh delivery",
  "Good quality ingredients",
];

const promiseCards = [
  {
    title: "Baked with love",
    body: "Every bake is made with care, warmth and the kind of attention only a family kitchen can give.",
  },
  {
    title: "Delivered fresh",
    body: "We handle our own deliveries so your desserts arrive fresh, on time and ready to delight.",
  },
  {
    title: "Quality ingredients",
    body: "We choose good quality ingredients that make every bite taste comforting, rich and memorable.",
  },
];

export function HomePage() {
  const { data: categories = [], isLoading } = useCategories();

  return (
    <div className="relative isolate overflow-hidden">
      <PageMotifs />

      <section className="mx-auto max-w-6xl px-2 pb-10 pt-8 sm:pt-6 md:pt-12">
        <div className="grid items-start gap-5 md:gap-8 lg:grid-cols-[0.9fr_1.1fr] sm:grid-cols-[0.9fr_1.1fr] lg:gap-12 sm:gap-8">
          <div className="flex flex-[0_0_auto] flex-col pt-2 md:pt-4">
            <div className="mb-4 flex flex-[0_0_auto] items-center gap-2 rounded-full border border-brand-200 bg-transparent px-3 py-1.5 text-center text-[11px] font-medium uppercase tracking-[0.22em] text-brand-700 md:w-full">
              <span className="inline-block h-2 w-2 rounded-full bg-brand-500" />
              <span className="inline-block">{HOME_COPY.hero.eyebrow}</span>
            </div>

            <div className="hero-headline-wrap">
              <h1 className="hero-headline max-w-[420px] text-5xl font-bold leading-[0.9] text-ink-900 md:text-[6rem] md:leading-[0.86]">
                <span className="hero-word hero-word-1 block">Baked</span>
                <span className="hero-word hero-word-2 block">fresh,</span>
                <span className="hero-word hero-word-4 block text-brand-500">
                  Made Just
                </span>
                <span className="hero-word hero-word-5 block text-brand-500">
                  for you!
                </span>
              </h1>
            </div>

            <p className="mt-5 max-w-[420px] text-base leading-7 text-ink-700 md:mt-6 md:text-[1.05rem] md:leading-8">
              We use good quality ingredients to bring you desserts that feel
              special, comforting and beautifully handmade.
            </p>

            <div className="mt-6 flex flex-wrap gap-3 md:mt-8">
              <Link
                to={HOME_COPY.hero.primaryCta.to}
                className="rounded-full bg-brand-500 px-6 py-3 text-sm font-medium text-white shadow-[0_12px_24px_rgba(227,28,121,0.25)] transition hover:-translate-y-0.5 hover:bg-brand-700"
              >
                {HOME_COPY.hero.primaryCta.label}
              </Link>
              <Link
                to={HOME_COPY.hero.secondaryCta.to}
                className="rounded-full border border-ink-700 bg-transparent px-6 py-3 text-sm font-medium text-ink-700 transition hover:bg-cream-100"
              >
                {HOME_COPY.hero.secondaryCta.label}
              </Link>
            </div>

            <div className="mt-5 flex max-w-[420px] flex-wrap gap-2 md:mt-7">
              {valuePills.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-cream-200 bg-white/70 px-3 py-1.5 text-xs font-medium text-ink-700 shadow-sm"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="relative w-full pt-1 md:pt-2">
            <HeroSlider />

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-[#eadfc8] bg-[#f0e7dc] p-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-brand-500">
                  Best seller
                </p>
                <p className="mt-2 text-lg font-semibold text-ink-900">
                  Signature cakes
                </p>
              </div>
              <div className="rounded-2xl border border-[#eadfc8] bg-[#f0e7dc] p-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-brand-500">
                  Occasions
                </p>
                <p className="mt-2 text-lg font-semibold text-ink-900">
                  Birthdays & gifting
                </p>
              </div>
              <div className="rounded-2xl border border-[#eadfc8] bg-[#f0e7dc] p-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-brand-500">
                  Coverage
                </p>
                <p className="mt-2 text-lg font-semibold text-ink-900">
                  Kolkata • Howrah • Hooghly
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-8 grid gap-4 md:grid-cols-3">
          {promiseCards.map((card) => (
            <div
              key={card.title}
              className="rounded-[1.5rem] border border-cream-200 bg-white p-5 shadow-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-500">
                Keyafe promise
              </p>
              <h3 className="mt-3 text-2xl text-ink-900">{card.title}</h3>
              <p className="mt-3 text-sm leading-7 text-ink-700">{card.body}</p>
            </div>
          ))}
        </div>

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
