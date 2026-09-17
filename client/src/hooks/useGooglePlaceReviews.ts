import { useQuery } from "@tanstack/react-query";
import { loadPlacesLibrary, getGoogleMapsApiKey } from "@/lib/googlePlaces";

export type GooglePlaceReview = {
  authorName: string;
  authorUri: string | null;
  photoUri: string | null;
  rating: number;
  text: string;
  relativeTime: string;
};

export type GooglePlaceReviewsData = {
  placeName: string;
  rating: number;
  reviewCount: number;
  mapsUri: string | null;
  writeReviewUri: string;
  reviews: GooglePlaceReview[];
};

function getPlaceId(): string | undefined {
  const id = import.meta.env.VITE_GOOGLE_PLACE_ID;
  return typeof id === "string" && id.trim().length > 0 ? id.trim() : undefined;
}

export function googleReviewsConfigured(): boolean {
  return Boolean(getGoogleMapsApiKey() && getPlaceId());
}

export function writeReviewUrl(placeId: string): string {
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
}

async function fetchGooglePlaceReviews(): Promise<GooglePlaceReviewsData | null> {
  const placeId = getPlaceId();
  if (!placeId || !getGoogleMapsApiKey()) return null;

  const places = await loadPlacesLibrary();
  const place = new places.Place({ id: placeId });
  await place.fetchFields({
    fields: ["displayName", "rating", "userRatingCount", "reviews", "googleMapsURI"],
  });

  const reviews: GooglePlaceReview[] = (place.reviews ?? [])
    .map((review) => {
      const text =
        typeof review.text === "string"
          ? review.text
          : ((review.text as { text?: string } | null)?.text ?? "");
      const author = review.authorAttribution;
      return {
        authorName: author?.displayName?.trim() || "Google user",
        authorUri: author?.uri ?? null,
        photoUri: author?.photoURI ?? null,
        rating: typeof review.rating === "number" ? review.rating : 0,
        text: text.trim(),
        relativeTime: review.relativePublishTimeDescription?.trim() || "",
      };
    })
    .filter((r) => r.text.length > 0 || r.rating > 0)
    .slice(0, 6);

  const rating = typeof place.rating === "number" ? place.rating : 0;
  const reviewCount =
    typeof place.userRatingCount === "number" ? place.userRatingCount : reviews.length;

  return {
    placeName: place.displayName?.trim() || "Keyafe",
    rating,
    reviewCount,
    mapsUri: place.googleMapsURI ?? null,
    writeReviewUri: writeReviewUrl(placeId),
    reviews,
  };
}

export function useGooglePlaceReviews() {
  const enabled = googleReviewsConfigured();
  return useQuery({
    queryKey: ["google-place-reviews", getPlaceId()],
    queryFn: fetchGooglePlaceReviews,
    enabled,
    staleTime: 1000 * 60 * 60, // 1 hour — reviews change slowly
    retry: 1,
  });
}
