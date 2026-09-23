import { Link } from "react-router-dom";
import { ProductCardTags } from "@/components/product/ProductTagBadge";
import { VegMark } from "@/components/product/VegMark";
import { Reveal } from "@/components/motion/Reveal";
import { SlideCarousel } from "@/components/ui/SlideCarousel";
import {
  categoryNames,
  useTagShowcase,
  type ProductCard,
  type TagShowcaseSection,
} from "@/hooks/useProducts";
import { HOME_COPY } from "@/content/home";
import { cn } from "@/lib/cn";

function priceLabel(product: ProductCard) {
  const value = `₹${Number(product.startingPrice).toFixed(0)}`;
  return product.template === "CAKE" ? value : `from ${value}`;
}

function Sheen() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 -left-1/3 hidden w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-[420%] motion-safe:block"
    />
  );
}

function SoldOut() {
  return (
    <span className="absolute top-2 right-2 z-10 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
      Out of stock
    </span>
  );
}

function TileImage({ product, className }: { product: ProductCard; className?: string }) {
  if (!product.images[0]) {
    return (
      <div className="flex h-full w-full items-center justify-center text-xs text-ink-500">
        No image
      </div>
    );
  }
  return (
    <img
      src={product.images[0]}
      alt={product.name}
      loading="lazy"
      className={cn(
        "h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]",
        className,
      )}
    />
  );
}

function PhotoTile({
  product,
  omitTagSlug,
  size = "lg",
}: {
  product: ProductCard;
  omitTagSlug?: string;
  size?: "lg" | "sm";
}) {
  const tags = omitTagSlug ? product.tags.filter((t) => t.slug !== omitTagSlug) : [];
  const large = size === "lg";
  const soldOut = !product.isAvailable;

  return (
    <Link
      to={`/product/${product.slug}`}
      className={cn(
        "group relative block h-full overflow-hidden rounded-card border border-cream-200 bg-cream-100 shadow-sm transition duration-300",
        soldOut ? "opacity-75" : "hover:-translate-y-1 hover:shadow-lg",
      )}
    >
      <div
        className={
          large
            ? "aspect-[16/10] sm:aspect-auto sm:h-full"
            : "aspect-[4/3] sm:aspect-auto sm:h-full"
        }
      >
        <TileImage product={product} className={soldOut ? "grayscale" : undefined} />
      </div>

      <Sheen />
      <div className="absolute top-2 left-2 z-10 flex flex-wrap items-start gap-1">
        {product.isEggless && <VegMark />}
        {tags.length > 0 && <ProductCardTags tags={tags} max={1} className="flex flex-wrap gap-1" />}
      </div>
      {soldOut && <SoldOut />}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-2.5 pt-8 sm:pt-10">
        {large && (
          <p className="text-[10px] tracking-wide text-white/70 uppercase">
            {categoryNames(product)}
          </p>
        )}
        <h3
          className={
            large
              ? "line-clamp-1 font-display text-base leading-snug text-white"
              : "line-clamp-1 text-xs font-medium text-white sm:text-sm"
          }
        >
          {product.name}
        </h3>
        <p
          className={
            large
              ? "text-sm font-semibold text-white"
              : "text-[11px] font-semibold text-white/90 sm:text-xs"
          }
        >
          {priceLabel(product)}
        </p>
      </div>
    </Link>
  );
}

/** Portrait card for the mobile rail. */
function RailCard({ product, omitTagSlug }: { product: ProductCard; omitTagSlug?: string }) {
  const tags = omitTagSlug ? product.tags.filter((t) => t.slug !== omitTagSlug) : [];
  const soldOut = !product.isAvailable;

  return (
    <Link
      to={`/product/${product.slug}`}
      className={cn(
        "group relative block overflow-hidden rounded-2xl border border-cream-200 bg-cream-100 shadow-sm",
        soldOut && "opacity-75",
      )}
    >
      <div className="aspect-[3/4]">
        <TileImage product={product} className={soldOut ? "grayscale" : undefined} />
      </div>
      <Sheen />
      <div className="absolute top-2 left-2 z-10 flex flex-wrap items-start gap-1">
        {product.isEggless && <VegMark />}
        {tags.length > 0 && <ProductCardTags tags={tags} max={1} className="flex flex-wrap gap-1" />}
      </div>
      {soldOut && <SoldOut />}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent p-3 pt-12">
        <h3 className="line-clamp-2 font-display text-sm leading-snug text-white">{product.name}</h3>
        <p className="mt-0.5 text-xs font-semibold text-white">{priceLabel(product)}</p>
      </div>
    </Link>
  );
}

function SoloBanner({ product, accent }: { product: ProductCard; accent: string }) {
  const soldOut = !product.isAvailable;
  return (
    <Link
      to={`/product/${product.slug}`}
      className={cn(
        "group flex items-center gap-3 rounded-card border border-cream-200 bg-white p-2 shadow-sm transition duration-300 sm:gap-4 sm:p-3",
        soldOut ? "opacity-75" : "hover:-translate-y-0.5 hover:shadow-md",
      )}
    >
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-cream-100 sm:h-24 sm:w-24">
        <TileImage product={product} className={soldOut ? "grayscale" : undefined} />
        <Sheen />
        {product.isEggless && <VegMark className="absolute top-1.5 left-1.5 z-10" />}
        {soldOut && (
          <span className="absolute inset-x-0 bottom-0 bg-ink-900/70 py-0.5 text-center text-[9px] font-semibold tracking-wide text-white uppercase">
            Out of stock
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] tracking-wide text-ink-500 uppercase">{categoryNames(product)}</p>
        <h3
          className={cn(
            "line-clamp-1 font-display text-base sm:text-lg",
            soldOut ? "text-ink-500" : "text-ink-900 transition-colors group-hover:text-brand-500",
          )}
        >
          {product.name}
        </h3>
        {product.shortDescription && (
          <p className="line-clamp-1 hidden text-sm text-ink-500 sm:block">
            {product.shortDescription}
          </p>
        )}
        <p className={cn("mt-0.5 text-sm font-semibold", soldOut ? "text-ink-500" : "text-ink-900")}>
          {priceLabel(product)}
        </p>
      </div>
      <span
        aria-hidden="true"
        className="shrink-0 pr-1 text-lg transition-transform duration-300 group-hover:translate-x-1"
        style={{ color: accent }}
      >
        →
      </span>
    </Link>
  );
}

function DesktopTiles({ section, accent }: { section: TagShowcaseSection; accent: string }) {
  const [first, second, third] = section.products;
  const slug = section.tag.slug;

  if (!first) return null;

  if (!second) {
    return <SoloBanner product={first} accent={accent} />;
  }

  if (!third) {
    return (
      <div className="grid h-44 grid-cols-2 gap-3">
        <PhotoTile product={first} omitTagSlug={slug} />
        <PhotoTile product={second} omitTagSlug={slug} />
      </div>
    );
  }

  return (
    <div className="grid h-56 grid-cols-5 grid-rows-2 gap-3">
      <div className="col-span-3 row-span-2 h-full">
        <PhotoTile product={first} omitTagSlug={slug} />
      </div>
      {[second, third].map((product) => (
        <div key={product.id} className="col-span-2 h-full">
          <PhotoTile product={product} size="sm" />
        </div>
      ))}
    </div>
  );
}

function TagChip({ name, accent }: { name: string; accent: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.18em] uppercase"
      style={{ borderColor: `${accent}33`, backgroundColor: `${accent}14`, color: accent }}
    >
      <span className="relative flex h-1.5 w-1.5">
        <span
          aria-hidden="true"
          className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 motion-reduce:hidden"
          style={{ backgroundColor: accent }}
        />
        <span
          className="relative inline-flex h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: accent }}
        />
      </span>
      {name}
    </span>
  );
}

function SectionHeader({ section, accent }: { section: TagShowcaseSection; accent: string }) {
  const seeAll = `/tag/${section.tag.slug}`;
  const heading = HOME_COPY.tagSections.headingBySlug[section.tag.slug] ?? section.tag.name;

  return (
    <Reveal>
      <div className="flex items-center justify-between gap-3">
        <TagChip name={section.tag.name} accent={accent} />
        <Link
          to={seeAll}
          aria-label={`${HOME_COPY.tagSections.seeAll} ${section.tag.name}`}
          className="group/see inline-flex shrink-0 items-center gap-1.5 rounded-full border py-1 pr-1 pl-2.5 text-xs font-semibold transition duration-300 hover:shadow-sm"
          style={{ borderColor: `${accent}33`, color: accent }}
        >
          {HOME_COPY.tagSections.seeAll}
          <span
            aria-hidden="true"
            className="grid h-5 w-5 place-items-center rounded-full text-[11px] transition-transform duration-300 group-hover/see:translate-x-0.5"
            style={{ backgroundColor: `${accent}1f` }}
          >
            →
          </span>
        </Link>
      </div>

      <h2 className="mt-2.5 font-display text-lg leading-tight tracking-tight text-ink-900 sm:text-xl">
        {heading}
      </h2>

      <div
        className="mt-2.5 mb-3 h-px origin-left scale-x-0 transition-transform duration-700 ease-out motion-reduce:scale-x-100 motion-reduce:transition-none [.reveal-visible_&]:scale-x-100"
        style={{ backgroundImage: `linear-gradient(to right, ${accent}66, transparent)` }}
        aria-hidden="true"
      />
    </Reveal>
  );
}

function TagColumn({ section }: { section: TagShowcaseSection }) {
  const accent = section.tag.colorHex ?? "#E31C79";

  if (section.products.length === 0) return null;

  return (
    <div className="min-w-0">
      <SectionHeader section={section} accent={accent} />

      {/* Mobile: one short horizontal rail of portrait cards */}
      <div className="sm:hidden">
        <SlideCarousel
          ariaLabel={section.tag.name}
          slideClassName="w-[72%]"
          autoPlayMs={0}
        >
          {section.products.map((product) => (
            <RailCard
              key={product.id}
              product={product}
              omitTagSlug={section.tag.slug}
            />
          ))}
        </SlideCarousel>
      </div>

      {/* sm+: mosaic / banner */}
      <div className="hidden sm:block">
        <DesktopTiles section={section} accent={accent} />
      </div>
    </div>
  );
}

export function TagShowcase() {
  const { data: sections = [] } = useTagShowcase();

  if (sections.length === 0) return null;

  return (
    <section className="relative z-10 mx-auto max-w-6xl px-4 py-8">
      <div className={cn("grid gap-8", sections.length > 1 && "lg:grid-cols-2 lg:gap-8")}>
        {sections.map((section) => (
          <TagColumn key={section.tag.slug} section={section} />
        ))}
      </div>
    </section>
  );
}
