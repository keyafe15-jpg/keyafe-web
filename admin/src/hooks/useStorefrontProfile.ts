import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface PlatformRating {
  rating: number;
  count: number;
}

export interface StorefrontProfile {
  tagline: string | null;
  /** Null → the storefront's bundled logo. */
  logoUrl: string | null;
  socialLinks: {
    instagram: string | null;
    facebook: string | null;
    zomato: string | null;
    swiggy: string | null;
  };
  platformRatings: { zomato: PlatformRating | null; swiggy: PlatformRating | null };
  publicLocation: {
    street: string;
    locality: string;
    city: string;
    region: string;
    postalCode: string;
    areaServed: string[];
    openingHours: string;
  };
}

const KEY = ["admin", "business", "storefront"];

export function useStorefrontProfile() {
  return useQuery<StorefrontProfile>({
    queryKey: KEY,
    queryFn: () => api.get<StorefrontProfile>("/admin/business/storefront"),
    staleTime: 60_000,
  });
}

export function useUpdateStorefrontProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: StorefrontProfile) =>
      api.patch<StorefrontProfile>("/admin/business/storefront", input),
    onSuccess: (data) => {
      qc.setQueryData(KEY, data);
    },
  });
}
