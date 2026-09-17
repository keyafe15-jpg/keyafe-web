import { useLocation } from "react-router-dom";
import { BRAND } from "@/content/brand";

interface SeoProps {
  /** Page title without the brand suffix. */
  title: string;
  description: string;
  /** Absolute or root-relative image for social previews. */
  image?: string;
  /** Keep transactional and private pages out of the index. */
  noIndex?: boolean;
}

/**
 * Sets per-page head tags. React 19 hoists <title>, <meta> and <link> rendered
 * anywhere in the tree into <head>, so this needs no helmet-style dependency.
 *
 * Note this is a client-rendered SPA: search engines execute JS and will see
 * these, but link unfurlers that do not run JS (WhatsApp, Facebook) fall back
 * to the static tags in index.html.
 */
export function Seo({ title, description, image, noIndex }: SeoProps) {
  const { pathname } = useLocation();
  const url = `${BRAND.siteUrl}${pathname}`;
  const fullTitle = title.includes(BRAND.name) ? title : `${title} | ${BRAND.name}`;
  const imageUrl = image
    ? image.startsWith("http")
      ? image
      : `${BRAND.siteUrl}${image}`
    : `${BRAND.siteUrl}${BRAND.logoSrc}`;

  return (
    <>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {noIndex && <meta name="robots" content="noindex,nofollow" />}

      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={BRAND.name} />
      <meta property="og:locale" content="en_IN" />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={imageUrl} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
    </>
  );
}

/**
 * Bakery / LocalBusiness structured data. This is where the things we make to
 * order but do not list as products — brownies, hampers, party trays, corporate
 * gifting — can still be declared to search engines.
 */
export function BakeryJsonLd({ offerings }: { offerings: readonly string[] }) {
  const { location } = BRAND;

  const address: Record<string, string> = {
    "@type": "PostalAddress",
    addressLocality: location.locality,
    addressRegion: location.region,
    postalCode: location.postalCode,
    addressCountry: location.country,
  };
  // Omitted rather than guessed — see the TODO in content/brand.ts.
  if (location.street) address.streetAddress = location.street;

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Bakery",
    name: BRAND.legalName,
    alternateName: BRAND.name,
    url: BRAND.siteUrl,
    logo: `${BRAND.siteUrl}${BRAND.logoSrc}`,
    image: `${BRAND.siteUrl}${BRAND.logoSrc}`,
    description: BRAND.tagline,
    telephone: BRAND.supportPhone,
    email: BRAND.supportEmail,
    priceRange: "₹₹",
    address,
    areaServed: location.areaServed.map((name) => ({ "@type": "City", name })),
    sameAs: [BRAND.socials.instagram, BRAND.socials.facebook],
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Bakes and catering",
      itemListElement: offerings.map((name) => ({
        "@type": "Offer",
        itemOffered: { "@type": "Product", name },
      })),
    },
  };
  if (location.openingHours) data.openingHours = location.openingHours;

  return (
    <script
      type="application/ld+json"
      // Structured data is a static string we build ourselves, not user input.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
