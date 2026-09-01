import { Link } from "react-router-dom";
import { HeroSlider } from "@/components/hero/HeroSlider";
import { PageMotifs } from "@/components/decor/PageMotifs";
import { Reveal } from "@/components/motion/Reveal";
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
    icon: "❤️",
    tint: "bg-brand-100 text-brand-500",
  },
  {
    title: "Delivered fresh",
    body: "We handle our own deliveries so your desserts arrive fresh, on time and ready to delight.",
    icon: "🚚",
    tint: "bg-emerald-100 text-emerald-600",
  },
  {
    title: "Quality ingredients",
    body: "We choose good quality ingredients that make every bite taste comforting, rich and memorable.",
    icon: "🌾",
    tint: "bg-amber-100 text-amber-600",
  },
];

export function HomePage() {
  const { data: categories = [], isLoading } = useCategories();

  return (
    <div className="relative isolate overflow-hidden">
      <PageMotifs />

      <div
        className="pointer-events-none absolute -left-32 top-[420px] -z-10 h-[420px] w-[420px] rounded-full bg-brand-300/25 blur-[110px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-40 top-[1100px] -z-10 h-[460px] w-[460px] rounded-full bg-emerald-200/30 blur-[120px]"
        aria-hidden="true"
      />

      <section className="mx-auto max-w-6xl px-2 pb-10 pt-5 sm:pt-6 md:pt-12">
        <div className="grid min-w-0 items-start gap-5 md:gap-8 lg:grid-cols-[0.9fr_1.1fr] sm:grid-cols-[0.9fr_1.1fr] lg:gap-12 sm:gap-8">
          <div className="flex min-w-0 flex-[0_0_auto] flex-col pt-2 md:pt-4">
            <div className="mb-3 flex flex-[0_0_auto] items-center gap-2 rounded-full border border-brand-200 bg-transparent px-3 py-1.5 text-center text-[11px] font-medium uppercase tracking-[0.22em] text-brand-700 md:mb-4 md:w-full">
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

            <p className="mt-3 max-w-[420px] text-base leading-7 text-ink-700 md:mt-6 md:text-[1.05rem] md:leading-8">
              We use good quality ingredients to bring you desserts that feel
              special, comforting and beautifully handmade.
            </p>

            <div className="mt-4 flex flex-wrap gap-3 md:mt-8">
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

            <div className="mt-4 flex max-w-[420px] flex-wrap gap-2 md:mt-7">
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

          <div className="relative w-full min-w-0 pt-1 md:pt-2">
            <HeroSlider />
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
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
              <div className="col-span-2 rounded-2xl border border-[#eadfc8] bg-[#f0e7dc] p-3 sm:col-span-1">
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

      <section className="relative mx-auto max-w-6xl px-4 py-12">
        <p className="mb-2 text-center text-xs font-semibold uppercase tracking-[0.28em] text-brand-500 sm:mb-3">
          Why Keyafe
        </p>
        <h2 className="mb-8 text-center font-display text-2xl text-ink-900 sm:mb-10 sm:text-3xl">
          Crafted with care, every single time
        </h2>

        <div className="relative mb-8 grid gap-3 sm:grid-cols-3 sm:gap-6">
          <div
            className="pointer-events-none absolute left-[16.6%] right-[16.6%] top-6 hidden border-t border-dashed border-brand-200 sm:block"
            aria-hidden="true"
          />
          {promiseCards.map((card, index) => (
            <Reveal key={card.title} delay={index * 100}>
              <div className="group relative flex items-center gap-3 rounded-2xl border border-cream-200 bg-white/70 p-4 shadow-sm backdrop-blur-md transition hover:-translate-y-1 hover:border-brand-200 hover:shadow-lg sm:flex-col sm:items-start sm:gap-0 sm:p-5">
                <span
                  className={`relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl ring-4 ring-white transition group-hover:scale-110 sm:mb-3 sm:h-12 sm:w-12 ${card.tint}`}
                >
                  {card.icon}
                </span>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-ink-900 sm:text-xl">
                    {card.title}
                  </h3>
                  <p className="mt-0.5 text-xs leading-5 text-ink-700 sm:mt-3 sm:text-sm sm:leading-7">
                    {card.body}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <div className="mb-6 flex items-center justify-center sm:mb-8">
          <div>
            <p className="mb-2 text-xs text-center font-semibold uppercase tracking-[0.28em] text-brand-500">
              Explore
            </p>
            <h2 className="text-3xl text-center">
              {HOME_COPY.sectionHeadings.shopByCategory}
            </h2>
          </div>
        </div>

        {/* mobile: story-style circles wrapped in a grid */}
        <div className="mb-2 grid grid-cols-3 gap-x-2 gap-y-4 sm:hidden">
          {isLoading &&
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="h-20 w-20 animate-pulse rounded-full bg-cream-100" />
                <div className="h-3 w-14 animate-pulse rounded bg-cream-100" />
              </div>
            ))}
          {!isLoading &&
            categories.map((c) => (
              <Link
                key={c.id}
                to={`/category/${c.slug}`}
                className="group flex flex-col items-center gap-2"
              >
                <span className="relative flex h-20 w-20 items-center justify-center rounded-full border-2 border-brand-200 bg-gradient-to-br from-brand-50 to-cream-100 p-1 shadow-sm transition group-active:scale-95">
                  {c.imageUrl ? (
                    <img
                      src={c.imageUrl}
                      alt={c.name}
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center rounded-full bg-white text-2xl">
                      🍰
                    </span>
                  )}
                </span>
                <span className="w-full break-words text-center text-xs font-medium leading-tight text-ink-900">
                  {c.name}
                </span>
              </Link>
            ))}
        </div>

        {/* sm and up: modern image tile grid */}
        <div className="hidden gap-6 sm:grid sm:grid-cols-2 lg:grid-cols-3">
          {isLoading &&
            Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse overflow-hidden rounded-[1.75rem] border border-cream-200 bg-white shadow-sm"
              >
                <div className="aspect-[4/3] bg-cream-100" />
              </div>
            ))}
          {!isLoading &&
            categories.map((c, index) => (
              <Reveal key={c.id} delay={(index % 3) * 80}>
                <Link
                  to={`/category/${c.slug}`}
                  className="group relative block aspect-[4/3] overflow-hidden rounded-[1.75rem] border border-cream-200 bg-cream-100 shadow-sm transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_24px_40px_rgba(26,33,42,0.14)]"
                >
                  {c.imageUrl ? (
                    <img
                      src={c.imageUrl}
                      alt={c.name}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-5xl">
                      🍰
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-ink-900/85 via-ink-900/10 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-5">
                    <h3 className="text-xl font-semibold text-white drop-shadow-sm">
                      {c.name}
                    </h3>
                    {c.description && (
                      <p className="mt-1 line-clamp-1 text-sm text-white/80">
                        {c.description}
                      </p>
                    )}
                    <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-white opacity-0 transition group-hover:opacity-100">
                      Shop now
                      <span
                        aria-hidden="true"
                        className="transition group-hover:translate-x-1"
                      >
                        →
                      </span>
                    </span>
                  </div>
                </Link>
              </Reveal>
            ))}
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl px-4 py-12">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] border border-cream-200 bg-gradient-to-br from-white/70 to-cream-50/60 p-8 shadow-sm backdrop-blur-md md:p-12">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -left-2 -top-6 font-display text-[7rem] leading-none text-brand-100 md:text-[9rem]"
            >
              &ldquo;
            </span>
            <div className="relative flex flex-col items-center gap-6 text-center md:flex-row md:justify-between md:text-left">
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
                className="shrink-0 rounded-full bg-brand-500 px-6 py-3 text-sm font-medium text-white shadow-[0_12px_24px_rgba(227,28,121,0.25)] transition hover:-translate-y-0.5 hover:bg-brand-700"
              >
                {HOME_COPY.quoteBanner.cta.label}
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
