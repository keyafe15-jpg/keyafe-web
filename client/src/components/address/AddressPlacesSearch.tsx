import { useEffect, useEffectEvent, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import {
  getGoogleMapsApiKey,
  kolkataLocationBias,
  loadPlacesLibrary,
  parsePlace,
  type ParsedPlace,
} from "@/lib/googlePlaces";

const fallbackInputClass =
  "w-full rounded-lg border border-cream-200 bg-white py-2 pl-9 pr-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";

export function AddressPlacesSearch({
  value,
  onChange,
  onPlaceSelect,
  placeholder = "Start typing your building, society, or area",
  className,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect: (place: ParsedPlace) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const elementRef = useRef<google.maps.places.PlaceAutocompleteElement | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "fallback" | "error">(() =>
    getGoogleMapsApiKey() ? "loading" : "fallback",
  );

  const handleSelect = useEffectEvent(
    async (event: google.maps.places.PlacePredictionSelectEvent) => {
      const prediction = event.placePrediction;
      if (!prediction) return;

      try {
        const place = prediction.toPlace();
        await place.fetchFields({
          fields: ["displayName", "formattedAddress", "addressComponents"],
        });
        const parsed = parsePlace(place);
        onChange(parsed.mapSearchQuery);
        onPlaceSelect(parsed);
        if (elementRef.current) {
          elementRef.current.value = parsed.mapSearchQuery;
        }
      } catch {
        setStatus("error");
      }
    },
  );

  const handleInput = useEffectEvent(() => {
    const next = elementRef.current?.value ?? "";
    onChange(next);
  });

  const handleError = useEffectEvent(() => {
    setStatus("error");
  });

  useEffect(() => {
    if (!getGoogleMapsApiKey()) {
      setStatus("fallback");
      return;
    }

    let cancelled = false;
    let element: google.maps.places.PlaceAutocompleteElement | null = null;
    let onSelect: ((e: Event) => void) | null = null;
    let onInput: ((e: Event) => void) | null = null;
    let onGmpError: ((e: Event) => void) | null = null;

    void loadPlacesLibrary()
      .then((places) => {
        if (cancelled || !hostRef.current) return;

        element = new places.PlaceAutocompleteElement({
          includedRegionCodes: ["in"],
          locationBias: kolkataLocationBias(),
          placeholder,
        });
        element.style.width = "100%";
        element.style.colorScheme = "light";
        if (disabled) element.disabled = true;
        if (value) element.value = value;

        onSelect = (e) => {
          void handleSelect(e as google.maps.places.PlacePredictionSelectEvent);
        };
        onInput = () => handleInput();
        onGmpError = () => handleError();

        element.addEventListener("gmp-select", onSelect);
        element.addEventListener("input", onInput);
        element.addEventListener("gmp-error", onGmpError);

        hostRef.current.replaceChildren(element);
        elementRef.current = element;
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      if (element) {
        if (onSelect) element.removeEventListener("gmp-select", onSelect);
        if (onInput) element.removeEventListener("input", onInput);
        if (onGmpError) element.removeEventListener("gmp-error", onGmpError);
        element.remove();
      }
      elementRef.current = null;
    };
    // placeholder / disabled applied via separate effects below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = elementRef.current;
    if (!el || status !== "ready") return;
    if (el.value !== value) el.value = value;
  }, [value, status]);

  useEffect(() => {
    const el = elementRef.current;
    if (!el || status !== "ready") return;
    el.placeholder = placeholder;
  }, [placeholder, status]);

  useEffect(() => {
    const el = elementRef.current;
    if (!el || status !== "ready") return;
    el.disabled = Boolean(disabled);
  }, [disabled, status]);

  const showFallback = status === "fallback" || status === "error";

  return (
    <div className={cn("relative", className)}>
      {status === "loading" && (
        <p className="mb-1 text-[11px] text-ink-500">Loading address search…</p>
      )}

      <div
        ref={hostRef}
        className={cn("w-full", showFallback && "hidden")}
        aria-hidden={showFallback}
      />

      {showFallback && (
        <div className="relative">
          <span className="text-ink-400 pointer-events-none absolute top-1/2 left-3 -translate-y-1/2">
            <svg
              width={16}
              height={16}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3-3" />
            </svg>
          </span>
          <input
            type="text"
            value={value}
            disabled={disabled}
            autoComplete="off"
            onChange={(e) => onChange(e.target.value)}
            placeholder={
              status === "error" ? "Search unavailable — type a place name for riders" : placeholder
            }
            className={fallbackInputClass}
          />
        </div>
      )}

      {status === "fallback" && (
        <p className="mt-1 text-[11px] text-ink-500">
          Google Maps key not set — type what riders should search on Uber / Rapido.
        </p>
      )}
      {status === "error" && (
        <p className="mt-1 text-[11px] text-brand-700">
          Couldn’t load Google Places. You can still type a map search manually.
        </p>
      )}
      {status === "ready" && !value && (
        <p className="mt-1 text-[11px] text-ink-500">
          Pick a nearby place if you can — or type what riders should search. Exact house goes in
          the fields below.
        </p>
      )}
    </div>
  );
}

export type { ParsedPlace };
