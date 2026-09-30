import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { BRAND } from "@/content/brand";

export interface PlatformRating {
  rating: number;
  count: number;
}

export interface StoreProfile {
  name: string;
  legalName: string;
  tagline: string;
  /** Null → the bundled logo. */
  logoUrl: string | null;
  /** Display form, e.g. "+91 93300 48665". */
  phone: string;
  /** `tel:` target, e.g. "+919330048665". */
  phoneHref: string;
  altPhone: string | null;
  altPhoneHref: string | null;
  email: string;
  socials: {
    instagram: string | null;
    facebook: string | null;
    zomato: string | null;
    swiggy: string | null;
  };
  ratings: { zomato: PlatformRating | null; swiggy: PlatformRating | null };
  location: {
    street: string;
    locality: string;
    city: string;
    region: string;
    postalCode: string;
    areaServed: string[];
    openingHours: string;
  };
}

const telTarget = (phone: string) => phone.replace(/[^\d+]/g, "");

const FALLBACK: StoreProfile = {
  name: BRAND.name,
  legalName: BRAND.legalName,
  tagline: BRAND.tagline,
  logoUrl: null,
  phone: BRAND.supportPhone,
  phoneHref: telTarget(BRAND.supportPhone),
  altPhone: BRAND.altPhone,
  altPhoneHref: telTarget(BRAND.altPhone),
  email: BRAND.supportEmail,
  socials: { ...BRAND.socials },
  ratings: { ...BRAND.platformRatings },
  location: { ...BRAND.location, areaServed: [...BRAND.location.areaServed] },
};

export function whatsappHref(phoneHref: string) {
  const digits = phoneHref.replace(/\D/g, "");
  return `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}`;
}

/** Shop details saved in Admin → Settings; the BRAND defaults until they load. */
export function useStoreProfile() {
  const { data } = useQuery({
    queryKey: ["store", "profile"],
    queryFn: () => api.get<StoreProfile | null>("/store/profile"),
    staleTime: 5 * 60_000,
  });
  const profile = data ?? FALLBACK;
  return {
    ...profile,
    logoSrc: profile.logoUrl || BRAND.logoSrc,
    logoAlt: `${profile.name} logo`,
    whatsappHref: whatsappHref(profile.phoneHref),
  };
}

/** Absolute URL for a root-relative path such as the logo. */
export function absoluteUrl(path: string) {
  return /^https?:\/\//i.test(path) ? path : `${BRAND.siteUrl}${path}`;
}
