import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { stateCodeFromName, stateNameFromCode } from "./indiaStates";

/** Bias Places results toward Greater Kolkata / Belur. */
export const KOLKATA_CENTER = { lat: 22.629, lng: 88.341 };
const KOLKATA_RADIUS_M = 45_000;

export type ParsedPlace = {
  line1: string;
  city: string;
  pincode: string;
  mapSearchQuery: string;
  state: string;
  stateCode: string;
};

export function getGoogleMapsApiKey(): string | undefined {
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  return typeof key === "string" && key.trim().length > 0 ? key.trim() : undefined;
}

let placesReady: Promise<google.maps.PlacesLibrary> | null = null;

export function loadPlacesLibrary(): Promise<google.maps.PlacesLibrary> {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    return Promise.reject(new Error("VITE_GOOGLE_MAPS_API_KEY is not set"));
  }
  if (!placesReady) {
    setOptions({ key: apiKey, v: "weekly" });
    placesReady = importLibrary("places");
  }
  return placesReady;
}

/** Soft bias (~45 km) around Kolkata for PlaceAutocompleteElement. */
export function kolkataLocationBias(): google.maps.CircleLiteral {
  return { center: KOLKATA_CENTER, radius: KOLKATA_RADIUS_M };
}

function component(
  components: google.maps.places.AddressComponent[] | undefined,
  type: string,
  short = false,
): string {
  const match = components?.find((c) => c.types.includes(type));
  if (!match) return "";
  return (short ? match.shortText : match.longText) ?? "";
}

/** Parse a Places API (New) `Place` after `fetchFields`. */
export function parsePlace(place: google.maps.places.Place): ParsedPlace {
  const components = place.addressComponents;
  const streetNumber = component(components, "street_number");
  const route = component(components, "route");
  const premise = component(components, "premise");
  const subpremise = component(components, "subpremise");
  const neighborhood =
    component(components, "neighborhood") ||
    component(components, "sublocality_level_1") ||
    component(components, "sublocality") ||
    component(components, "sublocality_level_2");

  const street = [streetNumber, route].filter(Boolean).join(" ");
  const displayName = place.displayName ?? "";
  const formatted = place.formattedAddress ?? "";

  const line1 =
    [premise, subpremise, street, neighborhood].filter(Boolean).join(", ") ||
    displayName ||
    formatted.split(",")[0]?.trim() ||
    "";

  const city =
    component(components, "locality") ||
    component(components, "administrative_area_level_3") ||
    component(components, "administrative_area_level_2") ||
    "Kolkata";

  // The state drives the GST split (CGST+SGST vs IGST), so keep whatever
  // Google returned rather than assuming West Bengal, and resolve its code.
  const rawState = component(components, "administrative_area_level_1");
  const stateCode = stateCodeFromName(rawState) ?? "";
  const state = stateNameFromCode(stateCode) ?? rawState;

  const pincode = component(components, "postal_code").replace(/\D/g, "").slice(0, 6);

  const mapSearchQuery = (
    displayName && formatted && !formatted.startsWith(displayName)
      ? `${displayName}, ${formatted}`
      : formatted || displayName || line1
  ).slice(0, 200);

  return {
    line1: line1.slice(0, 200),
    city,
    pincode,
    mapSearchQuery,
    state,
    stateCode,
  };
}
