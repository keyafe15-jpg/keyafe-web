import { useLocation } from "react-router-dom";
import { BRAND } from "@/content/brand";
import { absoluteUrl, useStoreProfile } from "@/hooks/useStoreProfile";

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
  const profile = useStoreProfile();
  const url = `${BRAND.siteUrl}${pathname}`;
  const fullTitle = title.includes(profile.name) ? title : `${title} | ${profile.name}`;
  const imageUrl = absoluteUrl(image ?? profile.logoSrc);

  return (
    <>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {noIndex && <meta name="robots" content="noindex,nofollow" />}

      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={profile.name} />
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
  const profile = useStoreProfile();
  const { location } = profile;
  const logo = absoluteUrl(profile.logoSrc);

  // Blank parts are omitted rather than guessed; wrong details rank worse than absent ones.
  const address: Record<string, string> = {
    "@type": "PostalAddress",
    addressCountry: BRAND.location.country,
  };
  if (location.street) address.streetAddress = location.street;
  if (location.locality || location.city) {
    address.addressLocality = location.locality || location.city;
  }
  if (location.region) address.addressRegion = location.region;
  if (location.postalCode) address.postalCode = location.postalCode;

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Bakery",
    name: profile.legalName,
    alternateName: profile.name,
    url: BRAND.siteUrl,
    logo,
    image: logo,
    description: profile.tagline,
    telephone: profile.phone,
    email: profile.email,
    priceRange: "₹₹",
    address,
    areaServed: location.areaServed.map((name) => ({ "@type": "City", name })),
    sameAs: [profile.socials.instagram, profile.socials.facebook].filter(Boolean),
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
