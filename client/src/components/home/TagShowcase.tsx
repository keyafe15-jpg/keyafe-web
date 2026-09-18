import { Link } from "react-router-dom";
import { ProductCardTags } from "@/components/product/ProductTagBadge";
import { Reveal } from "@/components/motion/Reveal";
import {
  categoryNames,
  useTagShowcase,
  type ProductCard,
  type TagShowcaseSection,
} from "@/hooks/useProducts";
import { HOME_COPY } from "@/content/home";

function priceLabel(product: ProductCard) {
  const value = `₹${Number(product.startingPrice).toFixed(0)}`;
  return product.template === "CAKE" ? value : `from ${value}`;
}

/** Sweeps a soft highlight across the image on hover. Skipped when motion is reduced. */
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
      Sold out
    </span>
  );
}

function TileImage({ product }: { product: ProductCard }) {
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
      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
    />
  );
}

/** Image-led tile. Text sits over the photo so the tile stays short. */
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

  return (
    <Link
      to={`/product/${product.slug}`}
      className="group relative block h-full overflow-hidden rounded-card border border-cream-200 bg-cream-100 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg"
    >
      <div
        className={
          large
            ? "aspect-square sm:aspect-[16/10] lg:aspect-auto lg:h-full"
            : "aspect-square sm:aspect-[4/3] lg:aspect-auto lg:h-full"
        }
      >
        <TileImage product={product} />
      </div>

      <Sheen />
      {tags.length > 0 && (
        <ProductCardTags
          tags={tags}
          max={1}
          className="absolute top-1.5 left-1.5 z-10 flex flex-wrap gap-1"
        />
      )}
      {!product.isAvailable && <SoldOut />}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-2 pt-8 sm:p-2.5 sm:pt-10">
        {large && (
          <p className="hidden text-[10px] tracking-wide text-white/70 uppercase sm:block">
            {categoryNames(product)}
          </p>
        )}
        <h3
          className={
            large
              ? "line-clamp-2 font-display text-sm leading-snug text-white sm:line-clamp-1 sm:text-base"
              : "line-clamp-2 text-[11px] leading-snug font-medium text-white sm:line-clamp-1 sm:text-sm"
          }
        >
          {product.name}
        </h3>
        <p
          className={
            large
              ? "text-xs font-semibold text-white sm:text-sm"
              : "text-[10px] font-semibold text-white/90 sm:text-xs"
          }
        >
          {priceLabel(product)}
        </p>
      </div>
    </Link>
  );
}

/**
 * A tag with a single product — portrait photo card on narrow twin columns,
 * banner row once there is room.
 */
function SoloTile({ product, accent }: { product: ProductCard; accent: string }) {
  return (
    <Link
      to={`/product/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-card border border-cream-200 bg-white shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md sm:flex-row sm:items-center sm:gap-4 sm:p-3"
    >
      <div className="relative aspect-square w-full shrink-0 overflow-hidden bg-cream-100 sm:aspect-auto sm:h-24 sm:w-24 sm:rounded-xl">
        <TileImage product={product} />
        <Sheen />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent p-2 pt-8 sm:hidden">
          <h3 className="line-clamp-2 font-display text-sm leading-snug text-white">
            {product.name}
          </h3>
          <p className="text-xs font-semibold text-white">{priceLabel(product)}</p>
        </div>
      </div>

      <div className="hidden min-w-0 flex-1 sm:block">
        <p className="text-[10px] tracking-wide text-ink-500 uppercase">{categoryNames(product)}</p>
        <h3 className="line-clamp-1 font-display text-lg text-ink-900 transition-colors group-hover:text-brand-500">
          {product.name}
        </h3>
        {product.shortDescription && (
          <p className="line-clamp-1 text-sm text-ink-500">{product.shortDescription}</p>
        )}
        <p className="mt-0.5 text-sm font-semibold text-ink-900">{priceLabel(product)}</p>
      </div>

      <span
        aria-hidden="true"
        className="hidden shrink-0 pr-1 text-lg transition-transform duration-300 group-hover:translate-x-1 sm:inline"
        style={{ color: accent }}
      >
        →
      </span>
    </Link>
  );
}

function TagTiles({ section, accent }: { section: TagShowcaseSection; accent: string }) {
  const [first, second, third] = section.products;
  const slug = section.tag.slug;

  if (!first) return null;

  if (!second) {
    return (
      <Reveal from="scale">
        <SoloTile product={first} accent={accent} />
      </Reveal>
    );
  }

  if (!third) {
    return (
      <div className="grid grid-cols-1 gap-2 sm:h-44 sm:grid-cols-2 sm:gap-3">
        <Reveal from="left" className="h-full">
          <PhotoTile product={first} omitTagSlug={slug} />
        </Reveal>
        <Reveal from="right" delay={120} className="h-full">
          <PhotoTile product={second} omitTagSlug={slug} />
        </Reveal>
      </div>
    );
  }

  // Twin-column mobile: stacked feature + pair. Wider screens keep the mosaic.
  return (
    <div className="grid grid-cols-2 gap-2 sm:h-56 sm:gap-3 sm:grid-cols-5 sm:grid-rows-2">
      <Reveal from="left" className="col-span-2 h-full sm:col-span-3 sm:row-span-2">
        <PhotoTile product={first} omitTagSlug={slug} />
      </Reveal>
      {[second, third].map((product, index) => (
        <Reveal
          key={product.id}
          from="right"
          delay={120 + index * 110}
          className="h-full sm:col-span-2"
        >
          <PhotoTile product={product} size="sm" />
        </Reveal>
      ))}
    </div>
  );
}

/** Live-looking accent chip, tinted with the tag's own colour. */
function TagChip({ name, accent }: { name: string; accent: string }) {
  return (
    <span
      className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full border px-2 py-0.5 text-[9px] font-semibold tracking-[0.14em] uppercase sm:px-2.5 sm:py-1 sm:text-[10px] sm:tracking-[0.18em]"
      style={{ borderColor: `${accent}33`, backgroundColor: `${accent}14`, color: accent }}
    >
      <span className="relative flex h-1.5 w-1.5 shrink-0">
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
      <span className="truncate">{name}</span>
    </span>
  );
}

function TagColumn({ section }: { section: TagShowcaseSection }) {
  const accent = section.tag.colorHex ?? "#E31C79";
  const seeAll = `/tag/${section.tag.slug}`;

  if (section.products.length === 0) return null;

  return (
    <div className="min-w-0">
      <Reveal>
        <TagChip name={section.tag.name} accent={accent} />

        <div className="mt-2 flex items-start justify-between gap-2 sm:mt-2.5">
          <h2 className="min-w-0 font-display text-sm leading-snug tracking-tight text-ink-900 sm:text-lg lg:text-xl">
            {HOME_COPY.tagSections.headingBySlug[section.tag.slug] ?? section.tag.name}
          </h2>

          <Link
            to={seeAll}
            aria-label={`${HOME_COPY.tagSections.seeAll} ${section.tag.name}`}
            className="group/see inline-flex shrink-0 items-center gap-1 rounded-full border py-0.5 pr-0.5 pl-2 text-[10px] font-semibold whitespace-nowrap transition duration-300 hover:shadow-sm sm:gap-1.5 sm:py-1 sm:pr-1 sm:pl-2.5 sm:text-xs"
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

        <div
          className="mt-2 mb-2.5 h-px origin-left scale-x-0 transition-transform duration-700 ease-out motion-reduce:scale-x-100 motion-reduce:transition-none sm:mt-2.5 sm:mb-3 [.reveal-visible_&]:scale-x-100"
          style={{ backgroundImage: `linear-gradient(to right, ${accent}66, transparent)` }}
          aria-hidden="true"
        />
      </Reveal>

      <TagTiles section={section} accent={accent} />
    </div>
  );
}

export function TagShowcase() {
  const { data: sections = [] } = useTagShowcase();

  if (sections.length === 0) return null;

  return (
    <section className="relative z-10 mx-auto max-w-6xl px-4 py-8">
      <div className="relative grid grid-cols-2 gap-3 sm:gap-6 lg:gap-8">
        {/* Twin-rail seam — reads as two shop windows side by side on mobile. */}
        <div
          className="pointer-events-none absolute top-6 bottom-2 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-cream-200 to-transparent lg:hidden"
          aria-hidden="true"
        />
        {sections.map((section) => (
          <TagColumn key={section.tag.slug} section={section} />
        ))}
      </div>
    </section>
  );
}
