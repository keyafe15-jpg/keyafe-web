import { useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { HeroSlider, type HeroSlideView } from "@/components/hero/HeroSlider";
import { HeroStaticBanner } from "@/components/hero/HeroStaticBanner";
import { HomePromoBanner } from "@/components/home/HomePromoBanner";
import { CategoryIconRow } from "@/components/home/CategoryIconRow";
import { ProductRail, RailChip } from "@/components/home/ProductRail";
import { QuickTiles } from "@/components/home/QuickTiles";
import { DeliveryReel } from "@/components/home/DeliveryReel";
import { RecentlyViewedRail } from "@/components/home/RecentlyViewedRail";
import { GoogleReviewsSection } from "@/components/home/GoogleReviewsSection";
import { TrustStrip } from "@/components/home/TrustStrip";
import { WhyKeyafe } from "@/components/home/WhyKeyafe";
import { StoreDoor } from "@/components/home/StoreDoor";
import { PageMotifs } from "@/components/decor/PageMotifs";
import { Reveal } from "@/components/motion/Reveal";
import { CatalogSearchBar } from "@/components/product/CatalogSearchBar";
import { BakeryJsonLd, Seo } from "@/components/seo/Seo";
import { HOME_COPY, HOME_SEO, KEYAFE_OFFERINGS } from "@/content/home";
import { useHeroSlides } from "@/hooks/useHeroSlides";
import { useHomeSections, type HomeSections } from "@/hooks/useProducts";
import { groupCategoriesByDepartment, useCategories, useDepartments } from "@/hooks/useCategories";

/** Tag and category rails alternate so neither kind bunches up. */
function interleaveRails(data: HomeSections | undefined): ReactNode[] {
  const tagRails = (data?.tags ?? []).map((section) => (
    <ProductRail
      key={`tag-${section.tag.slug}`}
      chip={section.tag.name}
      accent={section.tag.colorHex ?? undefined}
      heading={HOME_COPY.tagSections.headingBySlug[section.tag.slug] ?? section.tag.name}
      seeAllTo={`/tag/${section.tag.slug}`}
      products={section.products}
      omitTagSlug={section.tag.slug}
    />
  ));
  const categoryRails = (data?.categories ?? []).map((section) => (
    <ProductRail
      key={`category-${section.category.slug}`}
      chip={HOME_COPY.rails.category.chip}
      accent={section.category.accentHex ?? undefined}
      heading={section.category.name}
      sub={section.category.description}
      seeAllTo={`/category/${section.category.slug}`}
      products={section.products}
    />
  ));

  const rails: ReactNode[] = [];
  for (let i = 0; i < Math.max(tagRails.length, categoryRails.length); i += 1) {
    if (tagRails[i]) rails.push(tagRails[i]);
    if (categoryRails[i]) rails.push(categoryRails[i]);
  }
  return rails;
}

function EnquiryCard({
  copy,
  tone,
}: {
  copy: (typeof HOME_COPY.enquiries)["corporate" | "custom"];
  tone: "brand" | "ink";
}) {
  const brand = tone === "brand";
  return (
    <article
      className={
        brand
          ? "flex h-full flex-col rounded-2xl border border-cream-200 bg-gradient-to-br from-white/80 to-cream-50/70 p-3.5 shadow-sm backdrop-blur-md sm:p-6"
          : "flex h-full flex-col rounded-2xl border border-cream-200 bg-gradient-to-br from-white/80 to-brand-100/30 p-3.5 shadow-sm backdrop-blur-md sm:p-6"
      }
    >
      <p
        className={`text-[10px] font-semibold tracking-[0.18em] uppercase sm:text-[11px] sm:tracking-[0.22em] ${
          brand ? "text-brand-500" : "text-ink-500"
        }`}
      >
        {copy.eyebrow}
      </p>
      <h3 className="mt-1.5 font-display text-base leading-snug text-ink-900 sm:text-xl">
        {copy.title}
      </h3>
      <p className="mt-1.5 flex-1 text-[11px] leading-5 text-ink-500 sm:text-sm sm:leading-6">
        {copy.body}
      </p>
      <ul className="mt-3 hidden space-y-1.5 border-t border-cream-200 pt-3 sm:block">
        {copy.points.map((point) => (
          <li key={point} className="flex gap-2 text-sm text-ink-700">
            <span
              className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${brand ? "bg-brand-500" : "bg-ink-700"}`}
              aria-hidden
            />
            {point}
          </li>
        ))}
      </ul>
      <Link
        to={copy.cta.to}
        className={
          brand
            ? "home-cta-glow mt-4 inline-flex items-center justify-center rounded-full bg-brand-500 px-3 py-2.5 text-center text-[11px] font-medium text-white transition hover:-translate-y-0.5 hover:bg-brand-700 sm:mt-5 sm:px-5 sm:text-sm"
            : "mt-4 inline-flex items-center justify-center rounded-full border border-ink-700 bg-white/70 px-3 py-2.5 text-center text-[11px] font-medium text-ink-700 transition hover:-translate-y-0.5 hover:bg-white sm:mt-5 sm:px-5 sm:text-sm"
        }
      >
        {copy.cta.label}
      </Link>
    </article>
  );
}

export function HomePage() {
  const { data: categories = [] } = useCategories();
  const { data: departments = [] } = useDepartments();
  const { data: heroSlides, isPending: heroPending } = useHeroSlides();
  const { data: home } = useHomeSections();
  const rails = useMemo(() => interleaveRails(home), [home]);

  const slides = useMemo(
    (): HeroSlideView[] =>
      (heroSlides ?? []).map((slide) => ({
        key: slide.id,
        mediaType: slide.mediaType,
        desktopUrl: slide.desktopUrl,
        mobileUrl: slide.mobileUrl,
        posterUrl: slide.posterUrl,
        title: slide.title,
        line: slide.subtitle,
        to: slide.linkUrl,
      })),
    [heroSlides],
  );

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
        className="home-blob-alt pointer-events-none absolute top-[1400px] -right-40 -z-10 h-[460px] w-[460px] rounded-full bg-emerald-200/30 blur-[120px]"
        aria-hidden="true"
      />

      <HomePromoBanner />

      <section className="relative z-10 mx-auto max-w-6xl px-4 pt-3">
        <div className="overflow-hidden rounded-2xl shadow-sm">
          {/* Loading renders the slider's skeleton at the same height. */}
          {heroPending || slides.length > 0 ? <HeroSlider slides={slides} /> : <HeroStaticBanner />}
        </div>
      </section>

      <section className="relative z-10 mx-auto flex max-w-6xl flex-col gap-3 px-4 pt-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <h1 className="font-display text-lg leading-snug text-ink-900 sm:text-xl">
          {HOME_COPY.hero.offering}
        </h1>
        <CatalogSearchBar
          placeholder={HOME_COPY.search.placeholder}
          className="w-full border-white/60 bg-white/70 backdrop-blur-sm sm:max-w-sm"
        />
      </section>

      <CategoryIconRow />

      <ProductRail
        chip={HOME_COPY.rails.featured.chip}
        heading={HOME_COPY.rails.featured.heading}
        products={home?.featured ?? []}
      />

      {storeGroups.length > 0 && (
        <section className="relative z-10 mx-auto max-w-6xl px-4 py-5 sm:py-7">
          <RailChip label={HOME_COPY.storeDoors.eyebrow} />
          <h2 className="mt-1.5 mb-4 font-display text-lg leading-tight text-ink-900 sm:text-xl">
            {HOME_COPY.storeDoors.heading}
          </h2>
          <div className="store-pair grid grid-cols-2 items-start gap-3 sm:grid-cols-4 sm:gap-4 lg:gap-8">
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
        </section>
      )}

      {rails}

      <QuickTiles />
      <WhyKeyafe />
      <DeliveryReel />
      <RecentlyViewedRail />
      <GoogleReviewsSection />
      <TrustStrip />

      <section className="relative z-10 mx-auto max-w-6xl px-4 py-6 sm:py-8">
        <Reveal>
          <div className="mb-4">
            <RailChip label={HOME_COPY.enquiries.eyebrow} />
            <h2 className="mt-1.5 font-display text-lg leading-tight text-ink-900 sm:text-xl">
              {HOME_COPY.enquiries.heading}
            </h2>
          </div>
        </Reveal>
        <div className="grid grid-cols-2 gap-3 sm:gap-5">
          <Reveal from="left">
            <EnquiryCard copy={HOME_COPY.enquiries.corporate} tone="brand" />
          </Reveal>
          <Reveal from="right" delay={80}>
            <EnquiryCard copy={HOME_COPY.enquiries.custom} tone="ink" />
          </Reveal>
        </div>
      </section>
    </div>
  );
}
