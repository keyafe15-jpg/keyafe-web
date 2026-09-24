import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { HeroSlider, type CollectionSlide } from "@/components/hero/HeroSlider";
import { HomePromoBanner } from "@/components/home/HomePromoBanner";
import { TagShowcase } from "@/components/home/TagShowcase";
import { HomeFilm } from "@/components/home/HomeFilm";
import { DeliveryReel } from "@/components/home/DeliveryReel";
import { GoogleReviewsSection } from "@/components/home/GoogleReviewsSection";
import { StoreDoor } from "@/components/home/StoreDoor";
import { PageMotifs } from "@/components/decor/PageMotifs";
import { Reveal } from "@/components/motion/Reveal";
import { CatalogSearchBar } from "@/components/product/CatalogSearchBar";
import { BakeryJsonLd, Seo } from "@/components/seo/Seo";
import { SlideCarousel } from "@/components/ui/SlideCarousel";
import { HOME_COLLECTIONS, HOME_COPY, HOME_SEO, KEYAFE_OFFERINGS } from "@/content/home";
import { cn } from "@/lib/cn";
import {
  groupCategoriesByDepartment,
  useCategories,
  useDepartments,
  type CategoryDepartmentGroup,
  type CategoryNode,
} from "@/hooks/useCategories";

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

function PromiseCard({
  card,
  layout = "mobile",
}: {
  card: (typeof promiseCards)[number];
  layout?: "mobile" | "desktop";
}) {
  if (layout === "desktop") {
    return (
      <div className="group hover:border-brand-200 relative flex flex-col items-start rounded-2xl border border-cream-200 bg-white/70 p-5 shadow-sm backdrop-blur-md transition hover:-translate-y-1 hover:shadow-lg">
        <span
          className={`promise-bob relative z-10 mb-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-xl ring-4 ring-white transition group-hover:scale-110 ${card.tint}`}
          style={{ animationDelay: `${promiseCards.indexOf(card) * 0.4}s` }}
        >
          {card.icon}
        </span>
        <h3 className="text-xl font-semibold text-ink-900">{card.title}</h3>
        <p className="mt-3 text-sm leading-7 text-ink-700">{card.body}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full items-center gap-3 rounded-2xl border border-cream-200 bg-white/70 p-4 shadow-sm backdrop-blur-md">
      <span
        className={`promise-bob flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl ring-4 ring-white ${card.tint}`}
      >
        {card.icon}
      </span>
      <div className="min-w-0">
        <h3 className="text-base font-semibold text-ink-900">{card.title}</h3>
        <p className="mt-0.5 text-xs leading-5 text-ink-700">{card.body}</p>
      </div>
    </div>
  );
}

export function HomePage() {
  const { data: categories = [] } = useCategories();
  const { data: departments = [] } = useDepartments();

  const slides = useMemo((): CollectionSlide[] => {
    const images = imagesBySlug(categories);
    return HOME_COLLECTIONS.map((item) => {
      const imageUrl = item.categorySlug ? (images.get(item.categorySlug) ?? null) : null;
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
    () => groupCategoriesByDepartment(categories, departments).filter((g) => g.department),
    [categories, departments],
  );

  return (
    <div className="relative isolate overflow-x-clip">
      <Seo title={HOME_SEO.title} description={HOME_SEO.description} />
      <BakeryJsonLd offerings={KEYAFE_OFFERINGS} />
      <PageMotifs />

      <div
        className="home-blob pointer-events-none absolute top-[420px] -left-32 -z-10 h-[420px] w-[420px] rounded-full bg-brand-300/25 blur-[110px]"
        aria-hidden="true"
      />
      <div
        className="home-blob-alt pointer-events-none absolute top-[1100px] -right-40 -z-10 h-[460px] w-[460px] rounded-full bg-emerald-200/30 blur-[120px]"
        aria-hidden="true"
      />

      <section className="pb-0">
        <div className="relative w-full">
          <HeroSlider slides={slides} />
        </div>
      </section>

      <DeliveryReel />

      <section className="relative z-10 mx-auto max-w-6xl px-4 pt-5 pb-6 md:pt-7 md:pb-8">
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.15fr)] lg:items-stretch lg:gap-4 xl:gap-6">
          <div className="home-rise flex h-full flex-col rounded-2xl border border-white/50 bg-white/40 px-5 py-6 text-center shadow-sm backdrop-blur-md sm:px-6 sm:py-7 lg:text-left">
            <div
              className="home-rise border-brand-200/80 mb-3 inline-flex items-center gap-2 rounded-md border bg-white/50 px-3 py-1.5 text-[11px] font-medium tracking-[0.22em] text-brand-700 uppercase backdrop-blur-sm"
              style={{ animationDelay: "0.05s" }}
            >
              <span className="inline-block h-2 w-2 rounded-sm bg-brand-500" />
              <span>{HOME_COPY.hero.eyebrow}</span>
            </div>

            <h1 className="hero-headline font-bold text-ink-900">
              <span className="hero-word hero-word-1 block">{HOME_COPY.hero.heading[0]}</span>
              <span className="hero-word hero-word-4 block text-brand-500">
                {HOME_COPY.hero.heading[1]}
              </span>
              <span className="hero-offering mt-2 block text-ink-700">
                {HOME_COPY.hero.offering}
              </span>
            </h1>

            <p
              className="home-rise mx-auto mt-3 max-w-xl text-sm leading-6 text-ink-700 md:mt-4 md:text-base md:leading-7 lg:mx-0"
              style={{ animationDelay: "0.55s" }}
            >
              {HOME_COPY.hero.sub}
            </p>
            <p
              className="home-rise mx-auto mt-2 max-w-xl text-xs leading-5 text-ink-500 md:text-sm md:leading-6 lg:mx-0"
              style={{ animationDelay: "0.68s" }}
            >
              {HOME_COPY.hero.coverage.beforeLink}
              <Link
                to={HOME_COPY.hero.coverage.to}
                className="text-brand-600 decoration-brand-200 font-medium underline underline-offset-2 hover:text-brand-700"
              >
                {HOME_COPY.hero.coverage.linkLabel}
              </Link>
              {HOME_COPY.hero.coverage.afterLink}
            </p>

            <div
              className="home-rise mx-auto mt-5 w-full max-w-md lg:mt-auto lg:mx-0 lg:pt-6"
              style={{ animationDelay: "0.82s" }}
            >
              <CatalogSearchBar
                placeholder={HOME_COPY.search.placeholder}
                className="border-white/60 bg-white/55 backdrop-blur-sm"
              />
            </div>

            {/* Phone-only store buttons — from sm up the illustrated doors handle entry. */}
            <div
              className="home-rise mt-4 flex flex-wrap justify-center gap-3 sm:hidden"
              style={{ animationDelay: "0.95s" }}
            >
              <Link
                to={HOME_COPY.hero.primaryCta.to}
                className="home-cta-glow rounded-md bg-brand-500 px-5 py-2.5 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:bg-brand-700"
              >
                {HOME_COPY.hero.primaryCta.label}
              </Link>
              <Link
                to={HOME_COPY.hero.secondaryCta.to}
                className="rounded-md border border-ink-700 bg-white/50 px-5 py-2.5 text-sm font-medium text-ink-700 backdrop-blur-sm transition hover:bg-white/70"
              >
                {HOME_COPY.hero.secondaryCta.label}
              </Link>
            </div>
          </div>

          {/* Desktop bridge — draws the eye from copy to the doors */}
          <div
            className="home-rise hidden flex-col items-center justify-center self-center lg:flex"
            style={{ animationDelay: "0.9s" }}
            aria-hidden="true"
          >
            <span className="text-[10px] font-semibold tracking-[0.28em] text-ink-500 uppercase">
              or
            </span>
            <span className="store-bridge-pulse mt-2 text-brand-500">→</span>
          </div>

          <div className="flex flex-col">
            <Reveal>
              <div className="mb-4 text-center lg:mb-5 lg:text-left">
                <p className="mb-1 text-center text-xs font-semibold tracking-[0.28em] text-brand-500 uppercase lg:text-left">
                  {HOME_COPY.storeDoors.eyebrow}
                </p>
                <h2 className="text-center font-display text-xl text-ink-900 sm:text-2xl lg:text-left">
                  {HOME_COPY.storeDoors.heading}
                </h2>
              </div>
            </Reveal>
            <StoreDoorsMobileTabs groups={storeGroups} />
            <div className="store-pair hidden flex-1 items-end justify-center gap-5 sm:flex lg:justify-start lg:gap-6">
              {storeGroups.map((group, index) => (
                <Reveal key={group.department!.id} delay={index * 100} from="scale">
                  <StoreDoor
                    name={group.department!.name}
                    slug={group.department!.slug}
                    categories={group.categories}
                    palette={group.department!}
                    compact
                  />
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Reveal>
        <HomePromoBanner />
      </Reveal>

      <TagShowcase />
      <HomeFilm />
      <GoogleReviewsSection />

      <section className="relative z-10 mx-auto max-w-6xl px-4 py-12">
        <Reveal>
          <div className="mx-auto mb-8 max-w-xl rounded-2xl border border-white/50 bg-white/40 px-4 py-4 text-center shadow-sm backdrop-blur-md sm:mb-10">
            <p className="mb-2 text-xs font-semibold tracking-[0.28em] text-brand-500 uppercase">
              Why Keyafe
            </p>
            <h2 className="font-display text-2xl text-ink-900 sm:text-3xl">
              Crafted with care, every single time
            </h2>
          </div>
        </Reveal>

        <SlideCarousel ariaLabel="Why Keyafe" hideFrom="sm" slideClassName="w-full">
          {promiseCards.map((card) => (
            <PromiseCard key={card.title} card={card} layout="mobile" />
          ))}
        </SlideCarousel>

        <div className="relative mb-2 hidden gap-6 sm:grid sm:grid-cols-3">
          <div
            className="border-brand-200 pointer-events-none absolute top-6 right-[16.6%] left-[16.6%] border-t border-dashed"
            aria-hidden="true"
          />
          {promiseCards.map((card, index) => (
            <Reveal key={card.title} delay={index * 110}>
              <PromiseCard card={card} layout="desktop" />
            </Reveal>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-4 py-12">
        <Reveal>
          <div className="mx-auto mb-8 max-w-xl text-center">
            <p className="mb-2 text-xs font-semibold tracking-[0.28em] text-brand-500 uppercase">
              {HOME_COPY.enquiries.eyebrow}
            </p>
            <h2 className="font-display text-2xl text-ink-900 sm:text-3xl">
              {HOME_COPY.enquiries.heading}
            </h2>
          </div>
        </Reveal>

        <div className="grid grid-cols-2 gap-3 sm:gap-6">
          <Reveal from="left">
            <article className="flex h-full flex-col rounded-2xl border border-cream-200 bg-gradient-to-br from-white/80 to-cream-50/70 p-3.5 shadow-sm backdrop-blur-md sm:rounded-[1.75rem] sm:p-8">
              <p className="text-[10px] font-semibold tracking-[0.18em] text-brand-500 uppercase sm:text-[11px] sm:tracking-[0.22em]">
                {HOME_COPY.enquiries.corporate.eyebrow}
              </p>
              <h3 className="mt-1.5 font-display text-base leading-snug text-ink-900 sm:mt-2 sm:text-2xl">
                {HOME_COPY.enquiries.corporate.title}
              </h3>
              <p className="mt-1.5 flex-1 text-[11px] leading-5 text-ink-500 sm:mt-2 sm:text-sm sm:leading-6">
                {HOME_COPY.enquiries.corporate.body}
              </p>
              <ul className="mt-3 hidden space-y-2 border-t border-cream-200 pt-4 sm:mt-4 sm:block">
                {HOME_COPY.enquiries.corporate.points.map((point) => (
                  <li key={point} className="flex gap-2 text-sm text-ink-700">
                    <span
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500"
                      aria-hidden
                    />
                    {point}
                  </li>
                ))}
              </ul>
              <Link
                to={HOME_COPY.enquiries.corporate.cta.to}
                className="home-cta-glow mt-4 inline-flex items-center justify-center rounded-full bg-brand-500 px-3 py-2.5 text-center text-[11px] font-medium text-white transition hover:-translate-y-0.5 hover:bg-brand-700 sm:mt-6 sm:px-5 sm:py-3 sm:text-sm"
              >
                {HOME_COPY.enquiries.corporate.cta.label}
              </Link>
            </article>
          </Reveal>

          <Reveal from="right" delay={80}>
            <article className="flex h-full flex-col rounded-2xl border border-cream-200 bg-gradient-to-br from-white/80 to-brand-100/30 p-3.5 shadow-sm backdrop-blur-md sm:rounded-[1.75rem] sm:p-8">
              <p className="text-[10px] font-semibold tracking-[0.18em] text-ink-500 uppercase sm:text-[11px] sm:tracking-[0.22em]">
                {HOME_COPY.enquiries.custom.eyebrow}
              </p>
              <h3 className="mt-1.5 font-display text-base leading-snug text-ink-900 sm:mt-2 sm:text-2xl">
                {HOME_COPY.enquiries.custom.title}
              </h3>
              <p className="mt-1.5 flex-1 text-[11px] leading-5 text-ink-500 sm:mt-2 sm:text-sm sm:leading-6">
                {HOME_COPY.enquiries.custom.body}
              </p>
              <ul className="mt-3 hidden space-y-2 border-t border-cream-200 pt-4 sm:mt-4 sm:block">
                {HOME_COPY.enquiries.custom.points.map((point) => (
                  <li key={point} className="flex gap-2 text-sm text-ink-700">
                    <span
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-700"
                      aria-hidden
                    />
                    {point}
                  </li>
                ))}
              </ul>
              <Link
                to={HOME_COPY.enquiries.custom.cta.to}
                className="mt-4 inline-flex items-center justify-center rounded-full border border-ink-700 bg-white/70 px-3 py-2.5 text-center text-[11px] font-medium text-ink-700 transition hover:-translate-y-0.5 hover:bg-white sm:mt-6 sm:px-5 sm:py-3 sm:text-sm"
              >
                {HOME_COPY.enquiries.custom.cta.label}
              </Link>
            </article>
          </Reveal>
        </div>
      </section>
    </div>
  );
}

function StoreDoorsMobileTabs({ groups }: { groups: CategoryDepartmentGroup[] }) {
  const [active, setActive] = useState(0);
  const safeActive = Math.min(active, Math.max(0, groups.length - 1));
  const current = groups[safeActive];

  if (groups.length === 0 || !current?.department) return null;

  return (
    <div className="sm:hidden">
      <div
        role="tablist"
        aria-label="Stores"
        className="mx-auto mb-5 flex max-w-sm rounded-full border border-cream-200 bg-white/70 p-1 shadow-sm backdrop-blur-md"
      >
        {groups.map((group, index) => {
          const dept = group.department!;
          const selected = index === safeActive;
          return (
            <button
              key={dept.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(index)}
              className={cn(
                "flex-1 rounded-full px-3 py-2 text-xs font-semibold tracking-wide transition",
                selected
                  ? "bg-brand-500 text-white shadow-sm"
                  : "text-ink-600 hover:text-brand-700",
              )}
            >
              {dept.name} store
            </button>
          );
        })}
      </div>

      <StoreDoor
        name={current.department.name}
        slug={current.department.slug}
        categories={current.categories}
        palette={current.department}
      />
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
