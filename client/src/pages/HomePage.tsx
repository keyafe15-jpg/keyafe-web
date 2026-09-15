import { useMemo } from "react";
import { Link } from "react-router-dom";
import { HeroSlider, type CollectionSlide } from "@/components/hero/HeroSlider";
import { HomePromoBanner } from "@/components/home/HomePromoBanner";
import { HomeFilm } from "@/components/home/HomeFilm";
import { StoreDoor } from "@/components/home/StoreDoor";
import { PageMotifs } from "@/components/decor/PageMotifs";
import { Reveal } from "@/components/motion/Reveal";
import { HOME_COLLECTIONS, HOME_COPY } from "@/content/home";
import {
  groupCategoriesByDepartment,
  useCategories,
  useDepartments,
  type CategoryNode,
} from "@/hooks/useCategories";

const valuePills = [
  "All over Kolkata",
  "Eggless cakes",
  "Custom occasions",
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
  const { data: categories = [] } = useCategories();
  const { data: departments = [] } = useDepartments();

  const slides = useMemo((): CollectionSlide[] => {
    const images = imagesBySlug(categories);
    return HOME_COLLECTIONS.map((item) => {
      const imageUrl = item.categorySlug
        ? (images.get(item.categorySlug) ?? null)
        : null;
      const imageUrlMobile = item.mobileCategorySlug
        ? (images.get(item.mobileCategorySlug) ?? imageUrl)
        : imageUrl;
      return {
        title: item.title,
        line: item.line,
        to: item.to,
        imageUrl,
        imageUrlMobile,
      };
    });
  }, [categories]);

  const storeGroups = useMemo(
    () =>
      groupCategoriesByDepartment(categories, departments).filter(
        (g) => g.department,
      ),
    [categories, departments],
  );

  return (
    <div className="relative isolate overflow-x-clip">
      <PageMotifs />

      <div
        className="home-blob pointer-events-none absolute -left-32 top-[420px] -z-10 h-[420px] w-[420px] rounded-full bg-brand-300/25 blur-[110px]"
        aria-hidden="true"
      />
      <div
        className="home-blob-alt pointer-events-none absolute -right-40 top-[1100px] -z-10 h-[460px] w-[460px] rounded-full bg-emerald-200/30 blur-[120px]"
        aria-hidden="true"
      />

      <section className="pb-8">
        <div className="relative w-full">
          <HeroSlider slides={slides} />
        </div>

        <div className="home-rise relative z-10 mx-auto mt-5 max-w-3xl rounded-2xl border border-white/50 bg-white/40 px-5 py-6 text-center shadow-sm backdrop-blur-md md:mt-7 md:px-8 md:py-8">
          <div
            className="home-rise mb-3 inline-flex items-center gap-2 rounded-md border border-brand-200/80 bg-white/50 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.22em] text-brand-700 backdrop-blur-sm"
            style={{ animationDelay: "0.05s" }}
          >
            <span className="inline-block h-2 w-2 rounded-sm bg-brand-500" />
            <span>{HOME_COPY.hero.eyebrow}</span>
          </div>

          <h1 className="hero-headline mx-auto font-bold text-ink-900">
            <span className="hero-word hero-word-1 block">Baked fresh,</span>
            <span className="hero-word hero-word-4 block text-brand-500">
              Made just for you!
            </span>
          </h1>

          <p
            className="home-rise mx-auto mt-3 max-w-xl text-base leading-7 text-ink-700 md:mt-4 md:text-[1.05rem] md:leading-8"
            style={{ animationDelay: "0.55s" }}
          >
            {HOME_COPY.hero.sub}
          </p>
          <p
            className="home-rise mx-auto mt-2 max-w-xl text-sm leading-6 text-ink-500 md:text-base"
            style={{ animationDelay: "0.68s" }}
          >
            {HOME_COPY.hero.coverage.beforeLink}
            <Link
              to={HOME_COPY.hero.coverage.to}
              className="font-medium text-brand-600 underline decoration-brand-200 underline-offset-2 hover:text-brand-700"
            >
              {HOME_COPY.hero.coverage.linkLabel}
            </Link>
            {HOME_COPY.hero.coverage.afterLink}
          </p>

          <div
            className="home-rise mt-4 flex flex-wrap justify-center gap-3 md:mt-6"
            style={{ animationDelay: "0.82s" }}
          >
            <Link
              to={HOME_COPY.hero.primaryCta.to}
              className="home-cta-glow rounded-md bg-brand-500 px-6 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:bg-brand-700"
            >
              {HOME_COPY.hero.primaryCta.label}
            </Link>
            <Link
              to={HOME_COPY.hero.secondaryCta.to}
              className="rounded-md border border-ink-700 bg-white/50 px-6 py-3 text-sm font-medium text-ink-700 backdrop-blur-sm transition hover:bg-white/70"
            >
              {HOME_COPY.hero.secondaryCta.label}
            </Link>
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {valuePills.map((item, index) => (
              <span
                key={item}
                className="home-pill rounded-md border border-white/60 bg-white/45 px-3 py-1.5 text-xs font-medium text-ink-700 shadow-sm backdrop-blur-sm"
                style={{ animationDelay: `${0.95 + index * 0.08}s` }}
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      <Reveal>
        <HomePromoBanner />
      </Reveal>

      <HomeFilm />

      <section className="relative z-10 mx-auto max-w-6xl px-4 pb-4 pt-2 md:pt-4">
        <Reveal>
          <div className="mx-auto mb-6 max-w-xl rounded-2xl border border-white/50 bg-white/40 px-4 py-4 text-center shadow-sm backdrop-blur-md sm:mb-8">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-brand-500">
              {HOME_COPY.storeDoors.eyebrow}
            </p>
            <h2 className="font-display text-2xl text-ink-900 sm:text-3xl">
              {HOME_COPY.storeDoors.heading}
            </h2>
          </div>
        </Reveal>
        <div className="flex flex-wrap justify-center gap-8 sm:gap-12">
          {storeGroups.map((group, index) => (
            <Reveal key={group.department!.id} delay={index * 100} from="scale">
              <StoreDoor
                name={group.department!.name}
                slug={group.department!.slug}
                categories={group.categories}
                palette={group.department!}
              />
            </Reveal>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-4 py-12">
        <Reveal>
          <div className="mx-auto mb-8 max-w-xl rounded-2xl border border-white/50 bg-white/40 px-4 py-4 text-center shadow-sm backdrop-blur-md sm:mb-10">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-brand-500">
              Why Keyafe
            </p>
            <h2 className="font-display text-2xl text-ink-900 sm:text-3xl">
              Crafted with care, every single time
            </h2>
          </div>
        </Reveal>

        <div className="relative mb-2 grid gap-3 sm:grid-cols-3 sm:gap-6">
          <div
            className="pointer-events-none absolute left-[16.6%] right-[16.6%] top-6 hidden border-t border-dashed border-brand-200 sm:block"
            aria-hidden="true"
          />
          {promiseCards.map((card, index) => (
            <Reveal key={card.title} delay={index * 110}>
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
      </section>

      <section className="relative mx-auto max-w-6xl px-4 py-12">
        <Reveal from="scale">
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

function imagesBySlug(tree: CategoryNode[]) {
  const map = new Map<string, string>();
  for (const category of tree) {
    if (category.imageUrl) map.set(category.slug, category.imageUrl);
    for (const child of category.children) {
      if (child.imageUrl) map.set(child.slug, child.imageUrl);
    }
  }
  return map;
}
