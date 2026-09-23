import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { useMasterFlavours } from "@/hooks/useFlavours";
import { cn } from "@/lib/cn";
import {
  type CatalogFilterState,
  type CatalogSort,
  CATALOG_PRICE_CEILING,
  CATALOG_PRICE_FLOOR,
  CATALOG_PRICE_STEP,
  EMPTY_CATALOG_FILTERS,
  catalogFiltersAreActive,
  catalogFiltersFromSearchParams,
  writeCatalogFiltersToSearchParams,
} from "@/lib/catalogFilters";

type CatalogFiltersProps = {
  className?: string;
  /** Called when filters change so the parent can reset pagination. */
  onChange?: (filters: CatalogFilterState) => void;
};

/**
 * Flavour / price-range / sort controls for catalog listing pages.
 * State lives in the URL so filters are shareable and survive back/forward.
 * Shape filter is stubbed as a TODO until product shapes exist.
 */
export function CatalogFilters({ className, onChange }: CatalogFiltersProps) {
  const [params, setParams] = useSearchParams();
  const { data: flavours = [] } = useMasterFlavours();
  const filters = useMemo(() => catalogFiltersFromSearchParams(params), [params]);
  const active = catalogFiltersAreActive(filters);

  const urlMin = parseBound(filters.minPrice, CATALOG_PRICE_FLOOR);
  const urlMax = parseBound(filters.maxPrice, CATALOG_PRICE_CEILING);

  const [localMin, setLocalMin] = useState(urlMin);
  const [localMax, setLocalMax] = useState(urlMax);

  useEffect(() => {
    setLocalMin(urlMin);
    setLocalMax(urlMax);
  }, [urlMin, urlMax]);

  const patch = useCallback(
    (next: Partial<CatalogFilterState>) => {
      const merged: CatalogFilterState = { ...filters, ...next };
      setParams(
        (prev) => {
          const nextParams = new URLSearchParams(prev);
          writeCatalogFiltersToSearchParams(nextParams, merged);
          return nextParams;
        },
        { replace: true },
      );
      onChange?.(merged);
    },
    [filters, setParams, onChange],
  );

  function commitPrice(min: number, max: number) {
    patch({
      minPrice: min <= CATALOG_PRICE_FLOOR ? "" : String(min),
      maxPrice: max >= CATALOG_PRICE_CEILING ? "" : String(max),
    });
  }

  function clearAll() {
    setLocalMin(CATALOG_PRICE_FLOOR);
    setLocalMax(CATALOG_PRICE_CEILING);
    setParams(
      (prev) => {
        const nextParams = new URLSearchParams(prev);
        writeCatalogFiltersToSearchParams(nextParams, EMPTY_CATALOG_FILTERS);
        return nextParams;
      },
      { replace: true },
    );
    onChange?.(EMPTY_CATALOG_FILTERS);
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-cream-200 bg-white/70 p-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-end",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-ink-700 sm:mr-1">
        <SlidersHorizontal className="h-4 w-4 shrink-0 text-brand-500" aria-hidden="true" />
        <span className="text-xs font-semibold tracking-[0.18em] uppercase">Filter</span>
      </div>

      <FilterField label="Flavour">
        <div className="relative">
          <select
            value={filters.flavor}
            onChange={(e) => patch({ flavor: e.target.value })}
            className={selectClass}
          >
            <option value="">All flavours</option>
            {flavours.map((f) => (
              <option key={f.id} value={f.slug}>
                {f.name}
              </option>
            ))}
          </select>
          <ChevronDown className={chevronClass} aria-hidden="true" />
        </div>
      </FilterField>

      <FilterField label="Sort">
        <div className="relative">
          <select
            value={filters.sort}
            onChange={(e) => patch({ sort: e.target.value as CatalogSort })}
            className={selectClass}
          >
            <option value="featured">Featured</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
          </select>
          <ChevronDown className={chevronClass} aria-hidden="true" />
        </div>
      </FilterField>

      <div className="flex min-w-0 flex-col gap-1 sm:min-w-[220px] sm:flex-1 sm:max-w-xs">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] font-medium tracking-wide text-ink-500 uppercase">
            Price
          </span>
          <span className="text-xs tabular-nums text-ink-700">
            ₹{localMin.toLocaleString("en-IN")} – ₹{localMax.toLocaleString("en-IN")}
            {localMax >= CATALOG_PRICE_CEILING ? "+" : ""}
          </span>
        </div>
        <PriceRangeSlider
          min={localMin}
          max={localMax}
          onChange={(nextMin, nextMax) => {
            setLocalMin(nextMin);
            setLocalMax(nextMax);
          }}
          onCommit={commitPrice}
        />
      </div>

      {/* TODO: product shapes (round / square / heart) once modelled on Product */}
      <FilterField label="Shape">
        <div className="relative">
          <select disabled className={cn(selectClass, "cursor-not-allowed opacity-60")} value="">
            <option value="">Coming soon</option>
          </select>
          <ChevronDown className={chevronClass} aria-hidden="true" />
        </div>
      </FilterField>

      {active && (
        <button
          type="button"
          onClick={clearAll}
          className="inline-flex items-center gap-1 self-start rounded-full border border-cream-200 bg-cream-50 px-3 py-2 text-xs font-medium text-ink-700 transition hover:border-brand-200 hover:text-brand-600 sm:self-end"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Clear
        </button>
      )}
    </div>
  );
}

function PriceRangeSlider({
  min,
  max,
  onChange,
  onCommit,
}: {
  min: number;
  max: number;
  onChange: (min: number, max: number) => void;
  onCommit: (min: number, max: number) => void;
}) {
  const span = CATALOG_PRICE_CEILING - CATALOG_PRICE_FLOOR || 1;
  const leftPct = ((min - CATALOG_PRICE_FLOOR) / span) * 100;
  const rightPct = ((max - CATALOG_PRICE_FLOOR) / span) * 100;

  function setMin(raw: number) {
    onChange(Math.min(raw, max - CATALOG_PRICE_STEP), max);
  }

  function setMax(raw: number) {
    onChange(min, Math.max(raw, min + CATALOG_PRICE_STEP));
  }

  return (
    <div className="relative h-9 w-full touch-none select-none">
      <div className="pointer-events-none absolute inset-x-1 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-cream-200">
        <div
          className="absolute top-0 h-full rounded-full bg-brand-500"
          style={{ left: `${leftPct}%`, width: `${Math.max(0, rightPct - leftPct)}%` }}
        />
      </div>

      <input
        type="range"
        className="catalog-price-thumb"
        min={CATALOG_PRICE_FLOOR}
        max={CATALOG_PRICE_CEILING}
        step={CATALOG_PRICE_STEP}
        value={min}
        aria-label="Minimum price"
        onChange={(e) => setMin(Number(e.target.value))}
        onPointerUp={() => onCommit(min, max)}
        onKeyUp={() => onCommit(min, max)}
        style={{ zIndex: min > CATALOG_PRICE_CEILING - CATALOG_PRICE_STEP * 4 ? 5 : 3 }}
      />
      <input
        type="range"
        className="catalog-price-thumb"
        min={CATALOG_PRICE_FLOOR}
        max={CATALOG_PRICE_CEILING}
        step={CATALOG_PRICE_STEP}
        value={max}
        aria-label="Maximum price"
        onChange={(e) => setMax(Number(e.target.value))}
        onPointerUp={() => onCommit(min, max)}
        onKeyUp={() => onCommit(min, max)}
        style={{ zIndex: 4 }}
      />
    </div>
  );
}

function parseBound(raw: string, fallback: number) {
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] font-medium tracking-wide text-ink-500 uppercase">{label}</span>
      {children}
    </label>
  );
}

const selectClass =
  "h-9 w-full appearance-none rounded-full border border-cream-200 bg-white py-1.5 pr-8 pl-3 text-sm text-ink-900 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 sm:w-44";

const chevronClass =
  "pointer-events-none absolute top-1/2 right-2.5 h-3.5 w-3.5 -translate-y-1/2 text-ink-500";
