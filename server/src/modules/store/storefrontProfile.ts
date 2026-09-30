import { z } from "zod";
import { prisma } from "../../config/db.js";
import { formatPhone } from "./businessContact.js";

const blankToNull = z.literal("").transform(() => null);

const linkSchema = z
  .string()
  .trim()
  .max(500)
  .url("Enter a full link starting with https://")
  .refine((v) => /^https?:\/\//i.test(v), "Enter a full link starting with https://")
  .nullable()
  .or(blankToNull);

const ratingSchema = z
  .object({
    rating: z.coerce.number().min(0, "Ratings are 0–5").max(5, "Ratings are 0–5"),
    count: z.coerce.number().int().min(0),
  })
  .nullable();

export const socialLinksSchema = z.object({
  instagram: linkSchema,
  facebook: linkSchema,
  zomato: linkSchema,
  swiggy: linkSchema,
});

export const platformRatingsSchema = z.object({
  zomato: ratingSchema,
  swiggy: ratingSchema,
});

export const publicLocationSchema = z.object({
  street: z.string().trim().max(200),
  locality: z.string().trim().max(100),
  city: z.string().trim().max(100),
  region: z.string().trim().max(100),
  postalCode: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{6}$/.test(v), "Pincode must be 6 digits"),
  areaServed: z.array(z.string().trim().min(1).max(60)).max(20),
  openingHours: z.string().trim().max(200),
});

export const storefrontProfileSchema = z.object({
  tagline: z.string().trim().max(160).nullable().or(blankToNull),
  logoUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => /^(https?:\/\/|\/)/i.test(v), "Upload the logo again")
    .nullable()
    .or(blankToNull),
  socialLinks: socialLinksSchema,
  platformRatings: platformRatingsSchema,
  publicLocation: publicLocationSchema,
});

export type StorefrontProfileInput = z.infer<typeof storefrontProfileSchema>;

const EMPTY_LINKS: z.infer<typeof socialLinksSchema> = {
  instagram: null,
  facebook: null,
  zomato: null,
  swiggy: null,
};
const EMPTY_RATINGS: z.infer<typeof platformRatingsSchema> = { zomato: null, swiggy: null };
const EMPTY_LOCATION: z.infer<typeof publicLocationSchema> = {
  street: "",
  locality: "",
  city: "",
  region: "",
  postalCode: "",
  areaServed: [],
  openingHours: "",
};

function readJson<T>(schema: z.ZodType<T>, value: unknown, fallback: T): T {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : fallback;
}

export const storefrontProfileSelect = {
  tagline: true,
  logoUrl: true,
  socialLinks: true,
  platformRatings: true,
  publicLocation: true,
} as const;

export function toStorefrontProfile(settings: {
  tagline: string | null;
  logoUrl: string | null;
  socialLinks: unknown;
  platformRatings: unknown;
  publicLocation: unknown;
}): StorefrontProfileInput {
  return {
    tagline: settings.tagline,
    logoUrl: settings.logoUrl,
    socialLinks: readJson(socialLinksSchema, settings.socialLinks, EMPTY_LINKS),
    platformRatings: readJson(platformRatingsSchema, settings.platformRatings, EMPTY_RATINGS),
    publicLocation: readJson(publicLocationSchema, settings.publicLocation, EMPTY_LOCATION),
  };
}

/** Everything the storefront shows about the shop: name, contact, links, ratings, address. */
export async function getPublicStoreProfile() {
  const settings = await prisma.businessSettings.findFirst({
    select: {
      ...storefrontProfileSelect,
      legalName: true,
      tradeName: true,
      supportPhone: true,
      altPhone: true,
      supportEmail: true,
    },
  });
  if (!settings) return null;
  const main = formatPhone(settings.supportPhone);
  const alt = settings.altPhone ? formatPhone(settings.altPhone) : null;
  const profile = toStorefrontProfile(settings);
  return {
    name: settings.tradeName,
    legalName: settings.legalName,
    tagline: profile.tagline ?? "",
    logoUrl: profile.logoUrl,
    phone: main.phone,
    phoneHref: main.phoneHref,
    altPhone: alt?.phone ?? null,
    altPhoneHref: alt?.phoneHref ?? null,
    email: settings.supportEmail,
    socials: profile.socialLinks,
    ratings: profile.platformRatings,
    location: profile.publicLocation,
  };
}
